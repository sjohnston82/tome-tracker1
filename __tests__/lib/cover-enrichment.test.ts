import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ findMany: vi.fn(), updateMany: vi.fn(), lookup: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { book: { findMany: mocks.findMany, updateMany: mocks.updateMany } } }))
vi.mock('@/lib/metadata/covers', () => ({ findBookCover: mocks.lookup }))
import { fillMissingCovers } from '@/lib/enrichment/covers'
beforeEach(() => vi.resetAllMocks())
describe('missing cover enrichment', () => {
  it('scopes reads and writes to the signed-in user and preserves a concurrent manual cover', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'book', title: 'A Novel', author: { name: 'An Author' }, isbn13: null }])
    mocks.lookup.mockResolvedValue('https://covers.openlibrary.org/b/id/42-L.jpg')
    mocks.updateMany.mockResolvedValue({ count: 0 })
    expect(await fillMissingCovers('owner', 'previous')).toEqual({ processed: 1, updated: 0, errors: 0, next: null })
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 2, where: { userId: 'owner', coverUrl: null, coverLocked: false, id: { gt: 'previous' } } }))
    expect(mocks.updateMany).toHaveBeenCalledWith({ where: { id: 'book', userId: 'owner', coverUrl: null, coverLocked: false }, data: { coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' } })
  })
  it('advances beyond unmatched books so they cannot starve later batches', async () => {
    mocks.findMany.mockResolvedValue(Array.from({ length: 2 }, (_, i) => ({ id: String(i), title: 'Missing', author: { name: 'An Author' }, isbn13: null })))
    mocks.lookup.mockResolvedValue(null)
    vi.useFakeTimers()
    try {
      const result = fillMissingCovers('owner')
      await vi.runAllTimersAsync()
      expect(await result).toEqual({ processed: 2, updated: 0, errors: 0, next: '1' })
      expect(mocks.updateMany).not.toHaveBeenCalled()
    } finally { vi.useRealTimers() }
  })
})
