import https from 'https';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { RemoteData } from '../interface';
import { URL } from 'url';
import { addBaseUrlToHtml } from './html';
import { ensureDir } from './fs';
import { saveCacheDataToDatabase } from '../db/dbUseJson';
import { cookieCacheDb } from '../db/cookieDb';
import { parseCookie } from './cookie';

/**
 *注意
 1. 这个函数可以处理一次重定向，但如果有多次连续重定向，可能会导致栈溢出。在实际使用中，你可能需要设置一个最大重定向次数，以防止这种情况发生。 
 2. node 的 http 模块 header 里的 key 全小写
 * @param url 
 * @param headers 
 * @param timeout 
 * @returns 
 */
export function fetchRemoteContent(url: string, rawHeaders: https.RequestOptions['headers'], timeout = 300000): Promise<RemoteData> {
  if (!url) throw new Error('url is required');

  // 到 node 这里先把 headers 里的 key 全部转小写，方便下面处理，比如 cookie
  const headers = {} as Record<string, any>;
  for (const key in rawHeaders) {
    headers[key.toLowerCase()] = rawHeaders[key]
  }

  /**
   * 删除 header 中可能的 host，这个不能传递，应该交由 https 模块根据 url 自动设置。
   * ------------------------------------------------
   * "Host" 字段会由 HTTP 客户端（例如浏览器或 fetch 函数）
   * 根据 URL 自动设置。当在请求头中显式设置 "Host" 字段时，你实际上是在覆盖了 HTTP 客户端自动设置的值。如果设置的值与实际的目标主机不匹配，那么服务器可能会拒绝请求，或者返回错误的响应。 
   */
  delete headers.host;

  return new Promise((resolve, reject) => {
    const handleResponse = (res: http.IncomingMessage, url: string, isFromRedirect = false, parentHeaders = headers) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        // 要记录 cookie，否则可能进入循环重定向
        const setCookieHeaders = res.headers['set-cookie'] || [];
        const newCookie = setCookieHeaders.reduce((pre, cur: string) => {
          const cookie = parseCookie(cur);
          const { host } = new URL(url);
          const domain = cookie.domain || `.${host}`;
          // 很多请求都是在登录成功后 302 到原来页面，同时设置了票据相关的 cookie，这里要保存一份到数据库
          cookieCacheDb.upsertCookieByDomain(domain, cookie);
          return pre + `${cookie.name}=${cookie.value}; `;
        }, '')
        // 重新发起请求
        const newUrl = new URL(res.headers.location || '', url).toString();
        const curHeaders = {
          ...parentHeaders,
          cookie: parentHeaders.cookie + newCookie,
        } as any;

        /**
         * 如果要请求重定向的 url，不要返回压缩格式，因为后面要处理 html，不想解压了
         * */
        delete curHeaders['accept-encoding'];

        https
          .get(newUrl, {
            headers: curHeaders, timeout
          }, (res) => handleResponse(res, newUrl, true, curHeaders))
          .on('error', (error) => {
            reject(error);
          });
      } else {
        const chunks: any[] = [];

        res.on('data', (chunk: any) => {
          chunks.push(chunk);
        });

        res.on('end', () => {
          const contentType = res.headers['content-type'] || '';
          const contentEncoding = res.headers['content-encoding'] || '';
          const lastModified = res.headers['last-modified'] || '';
          const etag = res.headers.etag || '';
          const contentLength = parseInt(res.headers['content-length'] || '0', 10);
          const setCookieHeaders = res.headers['set-cookie'] || [];
          let data = Buffer.concat(chunks);

          if (isFromRedirect && contentType.includes('text/html')) {
            const html = data.toString();
            const urlObj = new URL(url);
            const baseUrl = urlObj.origin;
            const updatedHtml = addBaseUrlToHtml(html, baseUrl);
            data = Buffer.from(updatedHtml);
          }

          resolve({
            statusCode: res.statusCode || 200,
            contentType,
            contentEncoding,
            lastModified,
            etag,
            contentLength,
            data,
            isFromRedirect,
            setCookieHeaders: setCookieHeaders || [],
          });
        });
      }
    };

    https
      .get(url, { headers, timeout }, (res) => handleResponse(res, url))
      .on('error', (error) => {
        reject(error);
      });
  });
 }
/**
 TODO: 内容变动检测放到单独 process 里做
 */
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
    // throw new Error(`cacheData error: ${e}`);
  }
}

