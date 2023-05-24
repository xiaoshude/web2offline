import http from 'http';
import httpProxy from 'http-proxy';
import fs from 'fs';
import path from 'path';

// Create a proxy server
const proxy = httpProxy.createProxyServer({});

// Listen for the `proxyRes` event on `proxy`.
proxy.on('proxyRes', function (proxyRes: http.IncomingMessage, req: http.IncomingMessage, res: http.ServerResponse) {
  const chunks: Buffer[] = [];
  proxyRes.on('data', function (chunk: Buffer) {
    chunks.push(chunk);
  });
  proxyRes.on('end', function () {
    const body = Buffer.concat(chunks);
    // At this point, `body` has the entire request body stored in it as a string

    // Save the response body to a file
    const dir = path.join(__dirname, 'responses');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    const filePath = path.join(dir, `${Date.now()}.json`);
    fs.writeFileSync(filePath, body.toString());
  });
});



export async function startProxyServer() {
  new Promise((resolve, reject) => {
    // Create a server for the proxy
    const server = http.createServer(function (req: http.IncomingMessage, res: http.ServerResponse) {
      if (req.url === '/pacscript') {
        const pac = `
          function FindProxyForURL(url, host) {
            return "PROXY http://127.0.0.1:9898;";
          }
        `;
        res.writeHead(200, {
          'Content-Type': 'application/x-ns-proxy-autoconfig'
        });
        res.end(pac);
        return
      }
      console.log(`Received request for ${req.url}`);
      // This will pass the request to the real server
      proxy.web(req, res, { target: req.url as string });
    });
    server.on('error', (error) => {
      console.error(error);
    })
    // Listen to a specific port
    server.listen(9898, () => {
      resolve(null);
    });
  })


}




// in index.ts

// 试验了 electron 的 session.setProxy 方法，发现不行，拦截不了 https
// tryed:
/**

  await startProxyServer()

  // session.defaultSession.setProxy({ proxyRules: 'http=127.0.0.1:9898;https=127.0.0.1:9898' })
  session.defaultSession.setProxy({ pacScript: 'http://127.0.0.1:9898/pacscript' })
    .then(() => {
      console.log('Proxy set successfully');

  // and load the index.html of the app.
  mainWindow.loadURL(configJson.url || MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
      // const request = net.request('http://localhost:8080');
      // request.on('response', (response) => {
      //   console.log(`STATUS: ${response.statusCode}`);
      // });
      // request.end();
    }).catch((error) => {
      console.log('Failed to set proxy', error);
    });;

 */

// 这种方式能拦截 http 请求，但是依然不能拦截 https 请求

/**

 // session.defaultSession.setProxy({ proxyRules: 'http=127.0.0.1:9898;https=127.0.0.1:9898' })
  session.defaultSession.setProxy({ proxyRules: 'http=127.0.0.1:9898;https=127.0.0.1:9898' })
    .then(() => {
      console.log('Proxy set successfully');

  // and load the index.html of the app.
  mainWindow.loadURL(configJson.url || MAIN_WINDOW_WEBPACK_ENTRY);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
      // const request = net.request('http://localhost:8080');
      // request.on('response', (response) => {
      //   console.log(`STATUS: ${response.statusCode}`);
      // });
      // request.end();
    }).catch((error) => {
      console.log('Failed to set proxy', error);
    });;

 */
