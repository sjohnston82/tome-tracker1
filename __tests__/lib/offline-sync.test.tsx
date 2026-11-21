import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
const mocks = vi.hoisted(() => ({ stats: vi.fn(), write: vi.fn(), clear: vi.fn() }))
vi.mock('@/lib/offline/db', () => ({ getCacheStats: mocks.stats, cacheLibraryData: mocks.write, clearCache: mocks.clear, cacheRevision: () => 7, getCachedLibrary: vi.fn(), searchBooksOffline: vi.fn() }))
import { useOfflineLibrary } from '@/lib/hooks/useOfflineLibrary'
import { CacheOwnerProvider } from '@/lib/offline/owner'
const wrapper = ({ children }: { children: ReactNode }) => <CacheOwnerProvider userId="owner">{children}</CacheOwnerProvider>
const snapshot = { userId: 'owner', authors: [{ id: 'author', name: 'An Author', bio: null, photoUrl: null, books: [{ id: 'book', title: 'A Novel', isbn13: null, coverUrl: null, coverLocked: true, readingStatus: 'READING', seriesName: null, seriesNumber: null }] }] }
beforeEach(() => { vi.clearAllMocks(); mocks.stats.mockResolvedValue({ authorCount: 1, bookCount: 1, lastSync: null }); mocks.write.mockResolvedValue(true); mocks.clear.mockResolvedValue(undefined); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => snapshot })) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('settings offline sync wiring', () => {
  it('downloads the verified account and preserves reading/cover information in the cache', async () => {
    const { result } = renderHook(useOfflineLibrary, { wrapper })
    let success = false
    await act(async () => { success = await result.current.syncAndCache() })
    expect(success).toBe(true)
    expect(mocks.write).toHaveBeenCalledWith(expect.any(Array), expect.arrayContaining([expect.objectContaining({ readingStatus: 'READING', coverLocked: true })]), 'owner', 7)
    expect(fetch).toHaveBeenCalledWith('/api/library/sync', { cache: 'no-store' })
  })
  it('rejects another account’s or legacy service-worker response', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ ...snapshot, userId: 'other' }) } as Response)
    const { result } = renderHook(useOfflineLibrary, { wrapper })
    await act(async () => { expect(await result.current.syncAndCache()).toBe(false) })
    expect(mocks.write).not.toHaveBeenCalled()
  })
  it('reports failed cache writes instead of claiming successful sync', async () => {
    mocks.write.mockRejectedValue(new Error('Quota exceeded'))
    const { result } = renderHook(useOfflineLibrary, { wrapper })
    await act(async () => { expect(await result.current.syncAndCache()).toBe(false) })
  })
  it('does not fetch when offline', async () => {
    vi.spyOn(Navigator.prototype, 'onLine', 'get').mockReturnValue(false)
    const { result } = renderHook(useOfflineLibrary, { wrapper })
    await act(async () => { expect(await result.current.syncAndCache()).toBe(false) })
    expect(fetch).not.toHaveBeenCalled()
  })
  it('refreshes all mounted settings panels after a successful sync', async () => {
    const first = renderHook(useOfflineLibrary, { wrapper });
    const second = renderHook(useOfflineLibrary, { wrapper });
    await act(async () => {});
    expect(second.result.current.cacheStats?.bookCount).toBe(1);
    mocks.stats.mockResolvedValue({ authorCount: 2, bookCount: 259, lastSync: '2026-11-19T20:00:00Z' });
    await act(async () => { expect(await first.result.current.syncAndCache()).toBe(true); });
    expect(second.result.current.cacheStats?.bookCount).toBe(259);
    expect(second.result.current.cacheStats?.lastSync).toBe('2026-11-19T20:00:00Z');
  });

})
