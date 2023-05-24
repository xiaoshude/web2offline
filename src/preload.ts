// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

import { ipcRenderer } from "electron";

const sampleCookie = { url: "https://example.com", name: "mycookie", value: "myvalue" };

interface Cookie {
  url: string;
  name: string;
  value: string;
}

ipcRenderer.on("set-cookie", (event, cookie: Cookie) => {
  console.log("set-cookie", cookie);
  const oldCookies = document.cookie.split("; ");
  // update or insert new cookie
  const newCookies = oldCookies.map((oldCookie) => {
    const [name, value] = oldCookie.split("=");
    if (name === cookie.name) {
      return `${name}=${cookie.value}`;
    }
    return oldCookie;
  });
});
