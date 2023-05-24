export interface RemoteData {
  statusCode: number
  contentType: string
  contentEncoding: string
  lastModified: string
  etag: string
  contentLength: number
  data: Buffer
  isFromRedirect?: boolean
  setCookieHeaders?: string[]
}

export interface CacheData extends Omit<RemoteData, 'statusCode'> {
  filePath: string
}
