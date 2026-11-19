import { cacheRevision } from '@/lib/offline/db';
import { coverImageUrl } from '@/lib/books/cover-image';
export const OFFLINE_COVERS = 'offline-covers';
export const coverCacheKey = (url: string) => `/api/account/cover-download?url=${encodeURIComponent(url)}`;
export { allowedCoverURL } from '@/lib/metadata/offline-cover-url';
import { allowedCoverURL } from '@/lib/metadata/offline-cover-url';
export async function downloadCovers(urls: string[], onProgress: (done: number, total: number) => void) {
  if (typeof caches === 'undefined') throw new Error('Offline cover storage is unavailable in this browser.');
  const revision = cacheRevision();
  const cache = await caches.open(OFFLINE_COVERS);
  const candidates = [...new Set(urls.flatMap(url => [coverImageUrl(url, false), coverImageUrl(url, true)]))].filter(allowedCoverURL);
  let downloaded = 0, failed = 0, checked = 0;
  for (const url of candidates) {
    if (revision !== cacheRevision()) throw new Error('Cover download stopped because the local cache was cleared.');
    if (!navigator.onLine) throw new Error('Cover downloads stopped because you are offline. Previously downloaded covers are saved.');
    try { const key = coverCacheKey(url); if (!await cache.match(key)) { const response = await fetch(key, { cache: 'no-store' }); if (!response.ok) throw new Error('Unavailable'); if (revision !== cacheRevision()) throw new Error('Cache cleared'); await cache.put(key, response); } downloaded++; } catch { failed++; }
    onProgress(++checked, candidates.length);
  }
  return { downloaded, failed, unsupported: urls.filter(url => !allowedCoverURL(url)).length };
}
