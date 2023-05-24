// TODO: 暂时放在主进程，应该放在另一个单独进程检查

import { BrowserWindow } from "electron";
import { isUpdate } from "./utils/isUpdate";

// 每天检查一次更新
const interval = 1000 * 60 * 60 * 24;
export function startAutoUpdateTask(url: string) {
  setInterval(async () => {
    const showUpdate = await isUpdate(url);
    if (!showUpdate) return;

    const win = new BrowserWindow({
      show: false, // 初始状态下窗口不可见
      width: 800,
      height: 600,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      }
    });

    win.loadURL(url);

    win.webContents.on('did-finish-load', () => {
      win.close();
    })
  }, interval)
}
