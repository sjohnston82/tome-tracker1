import { describe, it, expect, vi, beforeEach } from 'vitest'

const db = vi.hoisted(() => ({
  series: { findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn() },
  work: { findFirst: vi.fn(), create: vi.fn() },
  seriesEntry: { findUnique: vi.fn(), create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma: db }))

import { addSeriesEntry, removeSeriesEntry } from '@/lib/series/service'
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
})
