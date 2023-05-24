export interface CookieObj {
  name: string;
  value: string;
  secure?: boolean;
  httpOnly?: boolean;
  domain?: string;
  path?: string;
  expires?: string;
}
export function parseCookie(cookieString: string): CookieObj {
  const cookie = {} as any;

  // Split the cookie string into an array of strings
  const items = cookieString.split('; ');

  // The first item is always the cookie name and value
  const [name, value] = items[0].split('=');
  cookie.name = name;
  cookie.value = value;

  // Iterate over the remaining items and set the optional properties
  for (let i = 1; i < items.length; i++) {
    // 统一搞成小写，http 中的 cookie 大小写不敏感
    const item = items[i].trim().toLowerCase();
    if (item === 'secure') {
      cookie.secure = true;
    } else if (item === 'httponly') {
      cookie.httpOnly = true;
    } else if (item.startsWith('domain=')) {
      cookie.domain = item.slice(7);
    } else if (item.startsWith('path=')) {
      cookie.path = item.slice(5);
    } else if (item.startsWith('expires=')) {
      // The Expires attribute is in the format 'Expires=Thu, 01 Jan 1970 00:00:00 GMT'
      // so we need to parse the date string
      cookie.expires = Date.parse(item.slice(8));
    }
  }


  return cookie;
}

export function upsertCookie(cookies: CookieObj[], cookieObj: CookieObj) {
  const cookie = cookies.find((cookie) => cookie.name === cookieObj.name);
  if (cookie) {
    Object.assign(cookie, cookieObj);
  } else {
    cookies.push(cookieObj);
  }

  return cookies
}
