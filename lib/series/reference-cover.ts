import { findBookCover } from '@/lib/metadata/covers'

// Reference artwork never updates a work or physical edition. Failed providers are not cached.
const cache = new Map<string, { url: string | null; expires: number }>()
const pending = new Map<string, Promise<string | null>>()
export function referenceCover(key: string, title: string, author: string): Promise<string | null> {
  const found = cache.get(key)
  if (found && found.expires > Date.now()) return Promise.resolve(found.url)
  const existing = pending.get(key)
  if (existing) return existing
  const lookup = findBookCover(title, author, undefined, true).then(url => {
    if (cache.size >= 1000) cache.delete(cache.keys().next().value!)
    cache.set(key, { url, expires: Date.now() + (url ? 86_400_000 : 900_000) })
    return url
  }).finally(() => pending.delete(key))
  pending.set(key, lookup)
  return lookup
}
