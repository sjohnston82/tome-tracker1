import { describe, it, expect, vi, beforeEach } from 'vitest'

const db = vi.hoisted(() => ({
  series: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  work: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
  book: { findFirst: vi.fn() },
  bookContent: { upsert: vi.fn(), deleteMany: vi.fn() },
  seriesEntry: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), updateMany: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma: db }))

import { addSeriesEntry, removeSeriesEntry, updateWork, updateSeriesEntry, linkEdition } from '@/lib/series/service'
import { createSeriesEntrySchema } from '@/lib/series/validation'

const workId = '11111111-1111-4111-8111-111111111111'

describe('series catalog security and validation', () => {
  beforeEach(() => vi.clearAllMocks())

  it('rejects invalid work IDs and positions', () => {
    expect(createSeriesEntrySchema.safeParse({ workId: 'bad' }).success).toBe(false)
    expect(createSeriesEntrySchema.safeParse({ workId, position: -1 }).success).toBe(false)
  })

  it('rejects linking a work that does not belong to the user', async () => {
    db.series.findFirst.mockResolvedValue({ id: 'series-1' })
    db.work.findFirst.mockResolvedValue(null)
    const result = await addSeriesEntry('owner', 'series-1', { workId, entryType: 'MAIN', isConfirmed: false })
    expect(result.error).toBe('NOT_FOUND')
    expect(db.seriesEntry.create).not.toHaveBeenCalled()
    expect(db.work.findFirst).toHaveBeenCalledWith({ where: { id: workId, userId: 'owner' }, select: { id: true } })
  })

  it('prevents duplicate work membership', async () => {
    db.series.findFirst.mockResolvedValue({ id: 'series-1' })
    db.work.findFirst.mockResolvedValue({ id: workId })
    db.seriesEntry.findUnique.mockResolvedValue({ id: 'existing' })
    const result = await addSeriesEntry('owner', 'series-1', { workId, entryType: 'MAIN', isConfirmed: false })
    expect(result.error).toBe('DUPLICATE')
    expect(db.seriesEntry.create).not.toHaveBeenCalled()
  })

  it('does not delete another user\'s series entry', async () => {
    db.seriesEntry.findFirst.mockResolvedValue(null)
    expect(await removeSeriesEntry('owner', 'series-1', 'entry-1')).toBe(false)
    expect(db.seriesEntry.findFirst).toHaveBeenCalledWith({
      where: { id: 'entry-1', seriesId: 'series-1', series: { userId: 'owner' } },
      select: { id: true },
    })
    expect(db.seriesEntry.delete).not.toHaveBeenCalled()
  })

  it('handles simultaneous duplicate-membership requests as conflicts', async () => {
    db.series.findFirst.mockResolvedValue({ id: 'series-1' })
    db.work.findFirst.mockResolvedValue({ id: workId })
    db.seriesEntry.findUnique.mockResolvedValue(null)
    db.seriesEntry.create.mockRejectedValue({ code: 'P2002' })
    expect(await addSeriesEntry('owner', 'series-1', { workId, entryType: 'MAIN', isConfirmed: false })).toMatchObject({ error: 'DUPLICATE' })
  })

  it('scopes work corrections and entry corrections to the owner', async () => {
    db.work.updateMany.mockResolvedValue({ count: 0 })
    db.seriesEntry.updateMany.mockResolvedValue({ count: 0 })
    expect(await updateWork('owner', workId, { title: 'Corrected' })).toBeNull()
    expect(db.work.updateMany).toHaveBeenCalledWith({ where: { id: workId, userId: 'owner' }, data: { title: 'Corrected' } })
    expect(await updateSeriesEntry('owner', 'series-1', 'entry-1', { position: 0.5 })).toBeNull()
    expect(db.seriesEntry.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'entry-1', seriesId: 'series-1', series: { userId: 'owner' }, work: { userId: 'owner' } } }))
  })

  it('rejects another user’s physical edition when linking omnibus contents', async () => {
    db.work.findFirst.mockResolvedValue({ id: workId })
    db.book.findFirst.mockResolvedValue(null)
    expect(await linkEdition('owner', workId, 'other-book')).toBeNull()
    expect(db.bookContent.upsert).not.toHaveBeenCalled()
    expect(db.book.findFirst).toHaveBeenCalledWith({ where: { id: 'other-book', userId: 'owner' }, select: { id: true } })
  })
})
