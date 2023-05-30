// 创建一个 http 服务，用于缓存静态文件和 api get 请求
import * as http from 'http';
import fs from 'fs';
import { getLocalFilePath } from './fs';
import { getCacheDataFromDatabase } from '../db/dbUseJson';
import { session } from 'electron';
import { fetchRemoteContent, saveCacheData } from './cache';
import { parseCookie } from './cookie';

import configJson = require('../../../config.json');
import { cookieCacheDb } from '../db/cookieDb';

const configHost = new URL(configJson.url).hostname;

export function getCookieStringFromCacheByUrl(url: string) {
  const urlObj = new URL(url);
  const host = urlObj.host;
  // get cookieString from cookieCacheDb 
  const domainCookies = cookieCacheDb.getCookieByHost(host);
  const cookieString = domainCookies ? domainCookies.map(cookie => {
    return `${cookie.name}=${cookie.value}`;
  }).join('; ') : '';

  return cookieString
}

export function onlineUrl2localFilePath(url: string): string {
  const { hostname, pathname } = getHostAndPathName(url);
  const localFilePath = getLocalFilePath(hostname, pathname);

  return localFilePath
}


function getHostAndPathName(url: string) {
  if (!isIncludeHost(url)) {
    // 说明是相对路径
    // eg: http://localhost:8989/web/test?v=1
    const pattern = /^\/([^?]*)/;
    const match = url.match(pattern);
    return {
      hostname: configHost,
      pathname: match[1],
    }
  }

  // 提取 hostname 和 pathname
  const pattern = /^\/([^\/]+)(\/[^?]*)/;
  const match = url.match(pattern);
  if (!match) {
    throw new Error(`The url ${url} did not match the pattern`);
  }
  const hostname = match[1];
  const pathname = match[2];

  console.log(`Hostname: ${hostname}, Pathname: ${pathname}`);
  return {
    hostname,
    pathname,
  }
}

/**
 * 
  FIXME:  只用 mimetype 是否为 json 标识是否为接口请求不完全准确
 * @param contentType 
 * @returns 
 */
function isApiRequestByContentType(contentType: string) {
  if (!contentType) return false;

  const apiContentTypes = 'application/json';
  return contentType.includes(apiContentTypes);
}

export function createCacheServer() {
  const server = http.createServer(async (req, res) => {
    // 拒绝非 GET 请求
    if (req.method !== 'GET') {
      res.writeHead(404);
      res.end();
      return;
    }

    // url eg: '/u.com/test?v比如1'
    const url = req.url;

    const { hostname, pathname } = getHostAndPathName(url);

    const localFilePath = onlineUrl2localFilePath(url);
    console.log('localFilePath', localFilePath)

    // 从 db 里查询缓存文件信息
    const cacheData = await getCacheDataFromDatabase(localFilePath);

    // cacheData & content type is static file
    // TODO: 添加更新策略
    if (cacheData && !isApiRequestByContentType(cacheData.contentType)) {
      const filePath = localFilePath;
      try {
        // TODO: 流式响应
        const cacheFileData = await fs.promises.readFile(filePath);
        console.log('mime', cacheData.contentType);
        // const contentType = normalizedContentType(cacheData.contentType);
        const contentType = cacheData.contentType;
        const contentEncoding = cacheData.contentEncoding;
        // http 返回 cacheFileData
        res.writeHead(200, {
          'Content-Type': contentType,
          'Content-Encoding': contentEncoding || '',
        })
        res.end(cacheFileData);

      } catch (e) {
        console.error(`读取文件失败: ${localFilePath}`, e);
        res.writeHead(500);
      }
      return
    }
    // 判断 req.url 是否包含 host
    // eg: /www.baidu.com/test?v=1
    let remoteUrl: string;
    if (isIncludeHost(req.url)) {
      remoteUrl = `https:/${req.url}`
    } else {
      remoteUrl = `https://${hostname}${req.url}`;
    }

    try {
      const { headers } = req;
      const urlObj = new URL(remoteUrl);
      const host = urlObj.host;
      // get cookieString from cookieCacheDb 
      const cookieString = getCookieStringFromCacheByUrl(remoteUrl);
      // TODO: 下面的添加 cookie 统一移到 session onBeforeRequest 处理
      console.log('fetchRemoteContent cookieString', cookieString);
      // add cookie to headers
      headers['cookie'] = cookieString;
      headers['referer'] = remoteUrl;
      // 如果有 cacheData, 对请求设置较短超时
      const remoteData = await fetchRemoteContent(remoteUrl, headers, cacheData ? 500 : 30000);
      if (!remoteData.isFromRedirect) {
        // 异步
        saveCacheData(remoteData, localFilePath);
      }

      if (remoteData.setCookieHeaders.length !== 0) {
        console.log('setCookieHeaders', remoteData.setCookieHeaders);
      }
      // Set received cookies in Electron's session
      await Promise.all(remoteData.setCookieHeaders.map(async cookie => {
        const parsedCookie = parseCookie(cookie);
        const domain = (parsedCookie as any).domain || `.${host}`;
        console.log('parsedCookie', parsedCookie);
        console.log('domain', domain);
        const remoteCookie = { ...parsedCookie, domain, url: `https://${host}/` }
        try {
          // 本地 cache 一份，用户 fetchRemoteContent 时使用
          // 为什么需要本地 cache，而不是直接 set cookie 到 localhost 呢？
          // 1. 多域名的情况下，cookie 可能覆盖
          // 2. cookies.set 这个api 有各种校验报错（like domain/url ...) 暂时不会用
          cookieCacheDb.upsertCookieByDomain(domain, remoteCookie);
          await session.defaultSession.cookies.set(remoteCookie)

        } catch (e) {
          console.log('remoteCookie', remoteCookie);
          console.error('set cookie error', e);

        }
      }));

      const contentType = remoteData.contentType;
      res.writeHead(remoteData.statusCode, {
        'Content-Type': contentType,
        'Content-Encoding': remoteData.contentEncoding || '',
      })
      res.end(remoteData.data);

    } catch (error) {
      console.error(hostname, pathname);
      console.error(`remoteUrl: ${remoteUrl}`);
      console.error(`网络请求出错: ${error}`);

      if (!cacheData) {
        res.writeHead(500);
        return
      }
      // 如果有本地缓存，使用本地缓存
      res.writeHead(200, {
        'Content-Type': cacheData.contentType,
        'Content-Encoding': cacheData.contentEncoding || '',
      })
      const cacheFileData = await fs.promises.readFile(localFilePath);
      res.end(cacheFileData);
    }

  });

  try {
    server.listen(8989);
  } catch (e) {
    // 按已启动处理，不抛出异常
    console.error('cache server 启动失败', e);
  }
}
/**
 * check url is include host
 * input '/vendor.js' output: false
 * input '/www.baidu.com/vendor.js' output: true
 * input '/' output false
 * @param url 
 * @returns 
 */
function isIncludeHost(url: string) {
  const pattern = /^\/([^\/]+)\//;
  const matched = url.match(pattern);
  // like '/'
  if (!matched) return false;

  const host = matched[1];
  if (host.includes('.')) {
    return true;
  }
  return false;
}
