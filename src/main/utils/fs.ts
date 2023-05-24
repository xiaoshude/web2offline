import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { webCacheDir } from '../const';


export const appDataPath = path.join(app.getPath('appData'), app.getName());

export function getLocalFilePath(hostname: string, pathname: string) {
  const normalizedPathname = pathname.endsWith('/') ? `${pathname}/index` : pathname;
  const localFilePath = path.join(
    appDataPath,
    webCacheDir,
    hostname,
    normalizedPathname,
  );
  return localFilePath;
}

export async function ensureDir(dir: string) {
  try {
    // Check if directory exists
    try {
      const stats = await fs.promises.stat(dir);
      // If it exists and it is a directory, return
      if (stats.isDirectory()) {
        return;
      }
    } catch (error) {
      // If stat throws an error, the directory probably doesn't exist
    }

    // If it doesn't exist or it is not a directory, create it
    await fs.promises.mkdir(dir, { recursive: true });
  } catch (e) {
    throw new Error(`ensureDir error: ${e}`);
  }
}

