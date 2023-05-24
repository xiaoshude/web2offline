import cheerio from 'cheerio';

/**
 * 只处理HTML 内容。如果你还需要处理 CSS 中的相对路径（例如 background-image: url(...)），那么你还需要一个 CSS 解析器来处理这种情况。
 * @param html 
 * @param baseUrl 
 * @returns 
 */
export function updateRelativeUrls(html: string | Buffer, baseUrl: string): string {
  const $ = cheerio.load(html);

  $('a[href], img[src], link[href], script[src]').each(function () {
    const elem = $(this);
    const attr = elem.is('a, link') ? 'href' : 'src';
    const url = elem.attr(attr);

    if (isRelativeUrl(url)) {
      const newUrl = new URL(url, baseUrl).toString();
      console.log('newUrl', elem.html(), elem.attr, newUrl);
      elem.attr(attr, newUrl);
    }
  });

  return $.html();
}

function isRelativeUrl(url: string) {
  try {
    new URL(url);
    return false;
  } catch (e) {
    return true;
  }
}


export function addBaseUrlToHtml(html: string, baseUrl: string): string {
  const $ = cheerio.load(html);
  $('head').prepend(`<base href="${baseUrl}">`);
  return $.html();
}
