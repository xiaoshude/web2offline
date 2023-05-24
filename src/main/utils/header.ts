import { objectAssignWithArrayValue, objectAssignWithArrayValueSpeciallyForHttpHeadrs } from "./object"

const staticExtendedHeaders = {
  'Access-Control-Allow-Headers': [
    'Content-Type',
    'authorization',
  ],
  'Access-Control-Allow-Methods': [
    'GET',
    'POST',
    'PATCH',
    'PUT',
    'DELETE',
    'OPTIONS',
  ],
  'Access-Control-Allow-Credentials': [true],


}

/**
 * HTTP 规范里 header 字段名称是大小写不敏感的，但是不同库可能有不同处理，比如 node 里全部处理为小写，浏览器里保持原样，electon 里呢？
 * 
 * 为了保险，这里不改变 requestHeaders key 的大小写，但 assign 时，大小写视为相同的key
 * @param responseHeaders 
 * @param origin 
 */
export function extendResponseHeader(responseHeaders: Record<string, string[]>, origin: string) {
  const dynamicExtendedHeaders = {
    ...staticExtendedHeaders,
    'Access-Control-Allow-Origin': [origin.replace(/(\/)?$/, '')],
  }

  objectAssignWithArrayValueSpeciallyForHttpHeadrs(responseHeaders, dynamicExtendedHeaders)

  // delete Referrer Policy: strict-origin-when-cross-origin
  delete responseHeaders['referrer-policy'];
}
