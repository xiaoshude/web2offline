import { defaultcookieCachePath } from "../const";
import { CookieObj, parseCookie, upsertCookie } from "../utils/cookie";
import { JsonDatabase } from "./dbUseJsonEnhanced";

/**
 * write by chatgpt 
 * prompt: 
```
实现函数： function getAllPossibleCookieDomainByHost(host: string): string[] {
 
} 比如输入 www.google.com 输出: [.www.google.com, .google.com]
```
 * @param host 
 * @returns 
 */
function getAllPossibleCookieDomainByHost(host: string): string[] {
  let parts = host.split('.');
  let result = [];

  for (let i = 0; i < parts.length - 1; i++) { // 忽略顶级域名（如.com）
    result.push('.' + parts.slice(i).join('.'));
  }

  // 最后再把当前域名加到最前面
  result.unshift(host);
  return result;
}

export class CookieDb extends JsonDatabase {
  constructor(path: string) {
    super(path);
  }

  getCookieByHost(host: string): CookieObj[] | null {
    // 同时获取主域名的 cookie，并排序
    const allPossibleDomains = getAllPossibleCookieDomainByHost(host);

    const cookies = allPossibleDomains.reduce((pre, domain) => {
      const curCookie = this.getItem(domain) as CookieObj[] | null;
      if (!curCookie) return pre;

      curCookie.forEach((cookie) => {
        if (!pre.some((item) => item.name === cookie.name)) {
          pre.push(cookie);
        }
      });
      return pre;
    }, [] as CookieObj[]);

    return cookies.length ? cookies : null;
  }

  upsertCookieByDomain(domain: string, cookieObj: CookieObj) {
    const oldValue = this.getItem(domain) as CookieObj[] | null;
    if (!oldValue) {
      this.setItem(domain, [cookieObj]);
      return;
    }

    const newCookie = upsertCookie(oldValue, cookieObj);

    this.setItem(domain, newCookie);
  }

  batchUpsertCookieByDomainAndSetCookieHeaders(domain: string, setCookieHeaders: string[] = []) {
    if (!setCookieHeaders.length) return;

    for (let i = 0; i < setCookieHeaders.length; i++) {
      const cookie = setCookieHeaders[i];
      const cookieObj = parseCookie(cookie);
      cookieCacheDb.upsertCookieByDomain(domain, cookieObj);
    }
  }
}


export const cookieCacheDb = new CookieDb(defaultcookieCachePath);
