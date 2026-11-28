export function allowedCoverURL(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && !url.port && ((url.hostname === 'covers.openlibrary.org' && /^\/b\/(id|isbn)\/[a-zA-Z0-9-]+\.jpg$/.test(url.pathname)) || (url.hostname === 'books.google.com' && url.pathname === '/books/content')); } catch { return false; }
}
