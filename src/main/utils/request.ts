import { app, session, BrowserWindow, net, ipcMain, Session, webFrameMain, WebFrameMain } from 'electron';
function request() {
  return new Promise((resolve, reject) => {
    const r = net.request({
      url: `https://127.0.0.1:${port}`,
      session: session.defaultSession,
    });
    r.on('response', (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk.toString('utf8');
      });
      res.on('end', () => {
        resolve(data);
      });
    });
    r.on('error', (err) => {
      reject(err);
    });
    r.end();
  });
}
