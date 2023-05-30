// @ts-nocheck
import sqlite3 from 'sqlite3';
import { CacheData } from '../main/interface';

// 目前只需要一个  db 实例
let dbInstance: sqlite3.Database | null;

export const getDbInstance = async (dbPath: string) => {
  if (!dbInstance) {
    dbInstance = new sqlite3.Database(dbPath);
  }

  return dbInstance
}

export async function initializeDatabase(dbPath: string) {
  const db = new sqlite3.Database(dbPath);

  const sql = `
  CREATE TABLE IF NOT EXISTS cache_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    filePath TEXT UNIQUE,
    contentType TEXT,
    contentEncoding TEXT,
    lastModified TEXT,
    etag TEXT,
    contentLength INTEGER
  )
`;

  db.run(sql, function (error) {
    if (error) {
      console.error(`Failed to create table 'cache_data': ${error}`);
    } else {
      console.log(`Table 'cache_data' has been created if it did not already exist.`);
    }
  });
}

export function saveCacheDataToDatabase(cacheData: CacheData) {
  const db = dbInstance;

  // 这里假设你的表名为 `cache_data`，并且已经创建好了相应的列
  const sql = `
    INSERT INTO cache_data (filePath, contentType, contentEncoding, lastModified, etag, contentLength)
    VALUES (?, ?, ?, ?, ?, ?)
  `;
  const params = [cacheData.filePath, cacheData.contentType, cacheData.contentEncoding, cacheData.lastModified, cacheData.etag, cacheData.contentLength];

  db.run(sql, params, function (error) {
    if (error) {
      console.error(`Failed to save data to SQLite database: ${error}`);
    } else {
      console.log(`Data saved to SQLite database.`);
    }
  });
}

export function getCacheDataFromDatabase(localFilePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const db = dbInstance;
    db.get('SELECT * FROM cache_data WHERE filePath = ?', [localFilePath], (err, row) => {
      if (err) {
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}
