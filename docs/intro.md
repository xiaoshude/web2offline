#  Web 变身桌面 APP：断网也能用

随着 Web 和 Native 之间的界限日益模糊，Web 能够完成的任务越来越多。得益于service worker，Web现在甚至可以在第二次访问时实现离线使用。然而，对于首次访问的离线使用，这依然是个挑战。本文将探讨如何利用Electron技术将Web转变为桌面应用，从而实现首次访问时的离线使用。
##  效果

![](assets/newqq2023-05-19%2015.44.33.gif)
![](assets/element2023-05-19%2016.27.55.gif)

为了达到这样的效果，我们需要提前缓存页面的静态资源和GET接口请求。

##  应用场景

- APP中原生页面与H5页面的无缝切换：例如，对聊天窗口中的特定域名URL进行预离线缓存，点击时即可直接打开，无需等待加载（类似Telegram的Instant View功能）；
- 提升Web使用体验：简单地为Web应用套上一个APP壳并不能真正提升体验，关键在于实现APP应该具有的无等待、无加载、无闪烁的体验；
  - 阅读/工具类应用：例如组件使用文档，无网络情况下也可以打开阅读；
  - 单页面应用：由于多路径复用的都是相同的静态文件，离线使用更易实现。
- APP的动态化：除了预先打包进安装包的静态文件，APP还可以通过URL增量扩展应用，实现APP在灵活性和体验之间的平衡。

...

##  预备知识

1. electron
2. http server  
3. 基本概念：electron session/protocol/main process/renderer process/ipc/preload

electron 应用符合 C/S 架构，与 Web 应用的对应关系如下：

- `main` → `preload` → `renderer`
- `server` → `ipc sdk` → `client`
- `server` → `http sdk` → `client`

无论 electron 应用多么复杂，都是由这三部分组成。

##  实现思路

1. 使用私有协议：
   1. 定义 electron  `protocol`，将 `https` 协议转换为 `app` 协议 
   2. 将所有的 get 请求 redirect 到 `app` 协议
   3. 在 `app` 协议中，先从缓存中读取，如果没有再通过 `https` 请求数据 

2. 使用 session.setProxy:
   1. 启动 http server，作为代理服务器
   2. 通过 setProxy 将所有的请求转发到 http server
   3. http server 对 get 请求进行缓存/读本地文件，post 请求直接转发

3. 使用 http server:
   1. 启动 http server，作为代理服务器
   2. 通过 beforeHeaderSend 将所有的 get 请求 redirect 到 http server
   3. http server 对 get 请求进行缓存/读本地文件

|                         | 方案 1 | 方案 2 | 方案 3 |
| ----------------------- | ------ | ------ |
|测试网站： https://news.qq.com/、 https://element-plus.org/zh-CN/    | 不通过: 如果页面中的存在 js 操作 document.cookie， 会报错    | 不通过：setProxy 配置 https 请求到 http 代理无效  | 通过    |

说明：目前仅走通了方案三，并非方案 1 和 2 不可行，只是暂时没找到对应卡点的解决办法。

下面就来仔细讲解方案三的实现。

##  整体框架

回顾一下我们的目标：实现一个 Electron 应用，该应用能加载一个 URL，并离线缓存页面中所有 GET 请求的响应，达到：加快下次请求的响应（静态文件优先本地/接口超时读本地）和断网可用的效果。

整体框架如下：

1. 创建 BrowserWindow  加载 URL

```js
const createWindow = (): void => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    height: 600,
    width: 800,
  });

  // 加载配置的 url
  mainWindow.loadURL(configJson.url);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};
```

2. 创建 http server：负责处理 get 请求，应用缓存策略。

```js
export function createCacheServer() {
  const server = http.createServer(async (req, res) => {
    // 拒绝非 GET 请求
    if (req.method !== 'GET') {
      res.writeHead(404);
      res.end();
      return;
    }

    // 缓存逻辑 
    // 从本地缓存中读取
    // 本地不存在，请求远端，写入本地缓存
    // cookie 处理
    // header 处理
    // redirect 处理
   });

  server.listen(8989);
}
```

3. 通过 `onBeforeRequest` 将所有的 get 请求 redirect 到 http server

```js
  const filter = { urls: ['http://*/*', 'https://*/*'] };
  session.webRequest.onBeforeRequest(filter, async (details, callback) => {
    // 终止逻辑   

    // 处理非 get 请求

    const url = new URL(details.url);
    const newHref = url.href.replace(/^https?:\//, localServerUrl);

    callback({ cancel: false, redirectURL: newHref });
  });
```

##  核心实现

### session 部分

1. 如何处理 redirect

- 如果请求是 GET 请求并且 URL 是 localhost，它会直接返回。
- 如果请求是 POST 请求并且 URL 是 localhost，它会将 URL 的协议更改为 https 并返回。-- 接口使用相对路径会出现这种情况
- 对于其他的 GET 请求，它会将 URL 的协议更改为本地服务器的 URL 并返回。

```js
hostSession.webRequest.onBeforeRequest(filter, async (details, callback) => {
  if (details.method === 'GET' && details.url.startsWith('http://localhost')) {
    callback({});
    return;
  }

  if (details.method === 'POST' && details.url.startsWith('http://localhost')) {
    const urlObj = new URL(details.url);
    const newHref = urlObj.href.replace(localServerUrl, `https://${host}`);
    callback({ cancel: false, redirectURL: newHref });
    return;
  }

  if (details.method !== 'GET') {
    callback({});
    return;
  }

  const url = new URL(details.url);
  const newHref = url.href.replace(/^https?:\//, localServerUrl);

  callback({ cancel: false, redirectURL: newHref });
});

```

2. 如何处理响应头里的 cookie

有 'set-cookie' 字段，缓存一份到本地，供 cache server 使用。

```js
hostSession.webRequest.onHeadersReceived(async (details, callback) => {
  const { responseHeaders, referrer } = details;

  const setCookieHeaders = responseHeaders['set-cookie'] || responseHeaders['Set-Cookie'];
  if (setCookieHeaders) {
    const cookies = setCookieHeaders;
    cookies.forEach(async (cookieString) => {
      const cookie = parseCookie(cookieString);
      cookieCacheDb.upsertCookieByDomain(cookie.domain, cookie)
    });
  }

  const origin = referrer || `${localServerUrl}`;
  extendResponseHeader(responseHeaders, origin);

  const statusLine = details.method.toLocaleLowerCase() === 'OPTIONS' ? '200' : `${details.statusCode}`;

  callback({ responseHeaders, statusLine });
});
```

### cache server 部分

1. 缓存策略

- 静态文件优先本地，不存在执行网络请求
- 接口优先网络，500ms超时读本地

```js
const cacheData = await getCacheDataFromDatabase(localFilePath);
if (cacheData && !isApiRequestByContentType(cacheData.contentType)) {
  // ...
  const cacheFileData = await fs.promises.readFile(filePath);
  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Encoding': contentEncoding || '',
  })
  res.end(cacheFileData);
  return
}
```

2. 处理远程请求

- 处理重定向（301 或 302 响应）
- 缓存数据格式设计；
- cookie 的处理；



```js
export function fetchRemoteContent(url: string, rawHeaders: https.RequestOptions['headers'], timeout = 300000): Promise<RemoteData> {
  // ...
  const handleResponse = (res: http.IncomingMessage, url: string, isFromRedirect = false, parentHeaders = headers) => {
    // ...
  };
  https
    .get(url, { headers, timeout }, (res) => handleResponse(res, url))
    .on('error', (error) => {
      reject(error);
    });
}
```

```js
export async function saveCacheData(responseData: RemoteData, localFilePath: string) {
  try {
    // Ensure dir
    await ensureDir(path.dirname(localFilePath));

    // Write buffer data to file
    await fs.promises.writeFile(localFilePath, responseData.data);

    // Save meta data to database
    const {
      contentType,
      contentEncoding,
      lastModified,
      etag,
      contentLength,
      data
    } = responseData;

    await saveCacheDataToDatabase({
      filePath: localFilePath,
      contentType,
      contentEncoding,
      lastModified,
      etag,
      contentLength,
      data,
    });
  } catch (e) {
    console.error('cacheData error', e);
    throw new Error(`cacheData error: ${e}`);
  }
}

```

> 缓存数据格式里 lastModified / etag，预留缓存更新使用。

```js
const setCookieHeaders = res.headers['set-cookie'] || [];
const newCookie = setCookieHeaders.reduce((pre, cur: string) => {
  const cookie = parseCookie(cur);
  const { host } = new URL(url);
  const domain = cookie.domain || `.${host}`;
  // 很多请求都是在登录成功后 302 到原来页面，同时设置了票据相关的 cookie，这里要保存一份到数据库
  cookieCacheDb.upsertCookieByDomain(domain, cookie);
  return pre + `${cookie.name}=${cookie.value}; `;
}, '')
```

### 缓存数据的储存

1. JSON 数据库操作

使用一个 JSON 文件作为简单的数据库。

```js

export class JsonDatabase {
  dbPath: string;
  database: any;
  eventEmitter: events.EventEmitter;

  constructor(path: string) {
    this.dbPath = path;
    this.database = null;
    this.eventEmitter = new events.EventEmitter();

    this.initializeDatabase();
  }

  async initializeDatabase() {
    await ensureDir(path.dirname(this.dbPath));
    if (!fs.existsSync(this.dbPath)) {
      // create file with empty json
      fs.writeFileSync(this.dbPath, JSON.stringify({}));
    }
    console.log(`JSON database has been initialized at ${this.dbPath}`);
  }

  onStore<T>(clb: (key: string, oldValue: T, newValue: T) => void): () => void {
    this.eventEmitter.addListener(EventTypes.STORE, clb);
    return () => this.eventEmitter.removeListener(EventTypes.STORE, clb);
  }

  getItem<T>(key: string): T {
    if (!this.database) {
      this.database = this.load();
    }
    return this.database[key];
  }

  setItem(key: string, data: any): void {
    if (!this.database) {
      this.database = this.load();
    }
    let oldValue = this.database[key];
    this.database[key] = data;
    this.save();
    this.eventEmitter.emit(EventTypes.STORE, key, oldValue, data);
  }

  removeItem(key: string): void {
    if (!this.database) {
      this.database = this.load();
    }
    if (this.database[key]) {
      let oldValue = this.database[key];
      delete this.database[key];
      this.save();
      this.eventEmitter.emit(EventTypes.STORE, key, oldValue, null);
    }
  }

  load(): any {
    try {
      return JSON.parse(fs.readFileSync(this.dbPath).toString());
    } catch (error) {
      console.error(error);
      return {};
    }
  }

  save(): void {
    fs.writeFileSync(this.dbPath, JSON.stringify(this.database, null, 4));
  }
}

```

2. Cookie 管理

扩展了 JsonDatabase 类并添加了特定于 cookies 的方法，如 getCookieByHost 和 upsertCookieByDomain。这些方法用于获取和更新特定域名的 cookies，模仿浏览器的行为。

```js
export class CookieDb extends JsonDatabase {
  constructor(path: string) {
    super(path);
  }

  getCookieByHost(host: string): CookieObj[] | null {
    const allPossibleDomains = getAllPossibleCookieDomainByHost(host);
    const cookies = allPossibleDomains.reduce((pre, domain) => {
      const curCookie = this.getItem(domain) as CookieObj[] | null;
      if (!curCookie) return pre;
      curCookie.forEach((cookie) => {
        if (!pre.some((item) => item.name === cookie.name)) {
          pre.push(cookie);
        }
      });
      return pre;
    }, [] as CookieObj[]);
    return cookies.length ? cookies : null;
  }

  upsertCookieByDomain(domain: string, cookieObj: CookieObj) {
    const oldValue = this.getItem(domain) as CookieObj[] | null;
    if (!oldValue) {
      this.setItem(domain, [cookieObj]);
      return;
    }
    const newCookie = upsertCookie(oldValue, cookieObj);
    this.setItem(domain, newCookie);
  }
}
```

## 技术要点

1. Web 转换为桌面应用：使用 Electron 技术，可以将 Web 应用转换为桌面应用，实现首次离线可用。这需要提前缓存页面的静态资源和 GET 接口请求。

2. 应用场景：这种技术可以应用于多种场景，包括 APP 内原生页面和 H5 的无缝切换，提升 Web 的使用体验，以及 APP 的动态化。

3. Electron 应用的 C/S 架构：Electron 应用符合 C/S 架构，主要包括 main、preload、renderer 三部分，与 Web 应用的 server、ipc sdk、client 对应。

4. 实现思路：提出了三种实现思路，包括使用私有协议、使用 session.setProxy 和使用 http server。这些方法主要涉及到请求的重定向、缓存处理和协议转换。

5. 预备知识：实现这些技术需要对 Electron、http server 以及 Electron session、protocol、main process、renderer process、ipc、preload 等基本概念有所了解。

##  附

### 代码
仓库：https://github.com/xiaoshude/web2offline

- [ ]: feat: 缓存更新；
- [ ]: feat: 缓存删除；
- [ ]: feat: 动态下发 url，通过隐藏窗口定时离线缓存/更新
- [ ]: refator: json 数据库 => sqlite
- [ ]: refator: cookie 操作

> 本文由 chatgpt 共同编辑
