import fs from 'fs';
import { getCacheDataFromDatabase } from '../db/dbUseJson';
import { fetchRemoteContent } from './cache';
import { getCookieStringFromCacheByUrl, onlineUrl2localFilePath } from './cacheServer';
export async function isUpdate(url: string): Promise<boolean> {
  const cookieString = getCookieStringFromCacheByUrl(url);
  const newResult = await fetchRemoteContent(url, {
    cookie: cookieString,
  })

  if (newResult.contentLength === 0) return false;
  if (!newResult.contentType.includes('text/html')) return false;

  // fs read cache.json
  // 计算 localFilePath
  const localFilePath = onlineUrl2localFilePath(url);


  const cacheJson = await getCacheDataFromDatabase(localFilePath);
  if (!cacheJson) return true;

  const oldCacheData = cacheJson;
  // 比较 lastModified
  const { lastModified, etag, contentLength } = newResult;
  if (lastModified !== oldCacheData.lastModified) return true;
  if (etag !== oldCacheData.etag) return true;
  if (contentLength !== oldCacheData.contentLength) return true;

  // 比较 content
  const newContent = newResult.data.toString();
  const oldContent = await fs.promises.readFile(localFilePath, 'utf-8');
  if (newContent !== oldContent) return true;

  return false;
}
