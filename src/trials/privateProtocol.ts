import fs from 'fs';
import { getCacheDataFromDatabase } from '../main/db/dbUseJson';
import { getLocalFilePath } from '../main/utils/fs';
import { normalizedContentType } from '../share/utils';
import { fetchRemoteContent, saveCacheData } from '../main/utils/cache';
import { parseCookie } from '../main/utils/cookie';

/**
 * 废弃私有协议的方式，改用 cacheServer
 * app:// 协议 相对于 cacheServer的 http 协议来说:
 * - 不能使用 cookie
 * TODO: 是否有解决办法
 * @deprecated
 * @param session 
 */
export function usePrivateAppProtocol(session: Electron.Session) {
  session.protocol.registerBufferProtocol('app', async function (request, respond) {
    const { hostname, pathname } = new URL(request.url);

    const localFilePath = getLocalFilePath(hostname, pathname);

    // 从 db 里查询缓存文件信息
    const cacheData = await getCacheDataFromDatabase(localFilePath);

    // cacheData & content type is static file
    // TODO: 添加更新策略
    // FIXME:  只用 mimetype 是否为 json 标识是否为接口请求不完全准确
    const apiContentTypes = ['application/json'];
    if (cacheData && !apiContentTypes.includes(cacheData.contentType)) {
      const filePath = localFilePath;
      try {
        const cacheFileData = await fs.promises.readFile(filePath);
        console.log('mime', cacheData.contentType);
        const contentType = normalizedContentType(cacheData.contentType);
        respond({
          mimeType: contentType,
          data: cacheFileData,
        });
      } catch (e) {
        console.error(`读取文件失败: ${localFilePath}`, e);
        respond({ statusCode: 500 });
      }
      return
    }

    try {
      const remoteUrl = request.url.replace('app://', 'https://');
      console.log('remoteUrl', remoteUrl);
      const { headers } = request;
      const urlObj = new URL(remoteUrl);
      const host = urlObj.host;
      // get cookie from session
      const cookieString = (await session.cookies.get({ domain: host })).map(cookie => {
        return `${cookie.name}=${cookie.value}`;
      }).join('; ');
      console.log('cookieString', cookieString);
      // add cookie to headers
      headers['Cookie'] = cookieString;
      const remoteData = await fetchRemoteContent(remoteUrl, headers);
      if (!remoteData.isFromRedirect) {
        // 异步
        saveCacheData(remoteData, localFilePath);
      }

      if (remoteData.setCookieHeaders.length !== 0) {
        console.log('setCookieHeaders', remoteData.setCookieHeaders);
      }
      // Set received cookies in Electron's session
      await Promise.all(remoteData.setCookieHeaders.map(cookie => {
        const parsedCookie = parseCookie(cookie);
        return session.cookies.set({
          ...parsedCookie, domain: host,
          url: ''
        });
      }));

      const contentType = normalizedContentType(remoteData.contentType);
      respond({
        mimeType: contentType,
        data: remoteData.data,
      });
    } catch (error) {
      console.error(`网络请求出错: ${error}`);
      respond({ statusCode: 404 });
    }
  });
}
