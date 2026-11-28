// @vitest-environment node
import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { openDB } from 'idb'
import { cacheLibraryData, getCachedLibrary, getCacheStats, clearCache, cacheRevision, checkOwnershipOffline, searchBooksOffline } from '@/lib/offline/db'
const authors = [{ id: 'author', name: 'An Author', bio: null, photoUrl: null }]
const books = [{ id: 'book', authorId: 'author', title: 'A Novel', isbn13: '9780000000001', coverUrl: null, seriesName: null, seriesNumber: null }]
beforeEach(async () => { await clearCache() })
afterEach(() => vi.unstubAllGlobals())
describe('offline cache account isolation and settings cleanup', () => {
  it('makes cached books, search and counts available only to their verified owner', async () => {
    await cacheLibraryData(authors, books, 'owner')
    expect((await getCachedLibrary('owner')).books).toHaveLength(1)
    expect((await getCachedLibrary('other')).books).toEqual([])
    expect((await getCacheStats('other')).bookCount).toBe(0)
    expect(await searchBooksOffline('Author', 'other')).toEqual([])
    expect(await checkOwnershipOffline('9780000000001', 'owner')).toBe(true)
    expect(await checkOwnershipOffline('9780000000002', 'owner')).toBe(false)
    expect(await checkOwnershipOffline('9780000000001', 'other')).toBe(false)
  })
  it('does not expose legacy caches that have no owner', async () => {
    await cacheLibraryData(authors, books, 'owner')
    const db = await openDB('tome-tracker', 1)
    await db.delete('metadata', 'owner'); db.close()
    expect((await getCachedLibrary('owner')).books).toEqual([])
  })
  it('does not let an old sync request refill a cleared cache', async () => {
    const revision = cacheRevision()
    await clearCache()
    expect(await cacheLibraryData(authors, books, 'owner', revision)).toBe(false)
    expect((await getCacheStats('owner')).bookCount).toBe(0)
  })
  it('clears only app library/image caches and preserves the app shell', async () => {
    await cacheLibraryData(authors, books, 'owner')
    const remove = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('caches', { delete: remove })
    await clearCache()
    expect((await getCachedLibrary('owner')).books).toEqual([])
    expect(remove.mock.calls.map(call => call[0])).toEqual(['library-sync', 'cover-images', 'google-covers', 'offline-covers'])
  })
  it('rolls back a failed sync instead of partially clearing a valid cache', async () => {
    await cacheLibraryData(authors, books, 'owner')
    await expect(cacheLibraryData([{ name: 'Missing key' } as typeof authors[number]], books, 'owner')).rejects.toThrow()
    expect((await getCachedLibrary('owner')).books).toEqual(books)
    expect((await getCachedLibrary('owner')).authors).toEqual(authors)
  })
})
