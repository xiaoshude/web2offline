export function normalizedContentType(contentType: string) {
  if (!contentType.includes(';')) return contentType;

  return contentType.split(';')[0];
}
export function normalizedContentEncoding(contentType: string) {
  if (!contentType.includes(';')) return contentType;

  return contentType.split(';')[0];
}




