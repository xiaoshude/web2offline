import { session } from "electron";
import { parseCookie } from '../utils/cookie';
import { localServerUrl } from '../const';
import { cookieCacheDb } from '../db/cookieDb';
import { extendResponseHeader } from '../utils/header';
// import { usePrivateAppProtocol } from './privateProtocol';

export async function useSessionForHost(host: string) {
  console.log('useSessionForHost', host);
  // const hostSession = session.fromPartition(host);
  const hostSession = session.defaultSession;

  // usePrivateAppProtocol(hostSession);

  //cookie注入和获取/cors配置
  hostSession.webRequest.onBeforeSendHeaders(async (details, callback) => {
    const { requestHeaders, url } = details;
    // // 获取当前 host 对应的 cookie
    // const cookies = await hostSession.cookies.get({ domain: details.url });
    // // 将 cookie 转换为字符串
    // const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    // // 添加到请求头中
    // requestHeaders['Cookie'] = cookieString;
    if (url.startsWith('https://') && !requestHeaders['Cookie']) {
      const urlObj = new URL(url);
      const host = urlObj.host;
      const cookies = await cookieCacheDb.getCookieByHost(host);
      if (!cookies) {
        return callback({ requestHeaders });
      }

      const cookieString = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
      // add to header
      console.log('onBeforeSendHeaders cookieString', cookieString)
      requestHeaders['Cookie'] = cookieString;
    }


    callback({ requestHeaders });
  });

  // 缓存静态文件和 api get 请求
  const filter = { urls: ['http://*/*', 'https://*/*'] };
  // 有没有办法不 redirectURL，直接返回本地文件的内容？
  // 有，通过 url 传，但是性能差
  hostSession.webRequest.onBeforeRequest(filter, async (details, callback) => {
    /**
      * 缓存所有 GET 请求，接口请求的 get 也要缓存。
      * 
      * 为什么接口请求的 get 也要缓存也通过 redirectURL 的方式？
      * 因为无法在 onCompleted 里获取到响应数据，所以都 redirect 交给 cacheServer 处理。
     * */
    // teminator: 防止循环 redirect
    if (details.method === 'GET' && details.url.startsWith('http://localhost')) {
      callback({});
      return;
    }

    // 如果是 post 而且 localhost，说明是相对路径的接口，需要改为 https://${host}
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

    console.log('onBeforeRequest', details.url, details.method, details.resourceType);

    const url = new URL(details.url);
    // const newHref = url.href.replace(/^https?:/, 'app:');
    const newHref = url.href.replace(/^https?:\//, localServerUrl);

    callback({ cancel: false, redirectURL: newHref });
  });

  hostSession.webRequest.onHeadersReceived(async (details, callback) => {
    const { responseHeaders, referrer } = details;

    const urlObj = new URL(details.url);
    const setCookieHeaders = responseHeaders['set-cookie'] || responseHeaders['Set-Cookie'];
    if (setCookieHeaders) {
      const cookies = setCookieHeaders;
      console.log('set-cookie', cookies);
      cookies.forEach(async (cookieString) => {
        const cookie = parseCookie(cookieString);
        cookieCacheDb.upsertCookieByDomain(cookie.domain || `.${urlObj.host}`, cookie)
      });
    }


    const origin = referrer || `${localServerUrl}`;
    extendResponseHeader(responseHeaders, origin);

    // option类型的探测请求可能会被cors拦截，需要手动把返回的httpcode设置成200
    const statusLine = details.method.toLocaleLowerCase() === 'OPTIONS' ? '200' : `${details.statusCode}`;

    callback({ responseHeaders, statusLine });
  });

  // 这里无法获得实际的响应数据，所以不能缓存 get 的接口请求
  hostSession.webRequest.onCompleted(async (details) => {

  })
}
