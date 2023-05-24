import path from 'path';
import { appDataPath } from './utils/fs';
export const webCacheDir = 'webCache';
// 数据库路径
export const defaultDbPath = path.resolve(appDataPath, 'cache.json');
export const defaultcookieCachePath = path.resolve(appDataPath, 'cookie_cache.json');

export const localServerHost = 'localhost:8989'
export const localServerHostWithoutPort = 'localhost'
export const localServerUrl = `http://${localServerHost}`;
