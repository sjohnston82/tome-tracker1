import { prisma } from '@/lib/db'
import type { z } from 'zod'
import { createSeriesSchema, createWorkSchema, createSeriesEntrySchema, updateSeriesSchema, updateWorkSchema, updateSeriesEntrySchema } from './validation'

type NewSeries = z.infer<typeof createSeriesSchema>
type NewWork = z.infer<typeof createWorkSchema>
type NewEntry = z.infer<typeof createSeriesEntrySchema>

// All reads and mutations are scoped to the signed-in user's catalog.
export async function listSeries(userId: string) {
  return prisma.series.findMany({
    where: { userId },
    include: {
      entries: {
        where: { work: { userId } },
        include: { work: { include: { editions: { where: { userId }, select: { id: true, title: true, readingStatus: true, isbn13: true } }, containedIn: { where: { book: { userId } }, include: { book: { select: { id: true, title: true, readingStatus: true, isbn13: true } } } } } } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      },
    },
    orderBy: { name: 'asc' },
  })
}

export async function getSeries(userId: string, id: string) {
  return prisma.series.findFirst({
    where: { id, userId },
    include: {
      entries: {
        where: { work: { userId } },
        include: { work: { include: { editions: { where: { userId }, select: { id: true, title: true, readingStatus: true, isbn13: true } }, containedIn: { where: { book: { userId } }, include: { book: { select: { id: true, title: true, readingStatus: true, isbn13: true } } } } } } },
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
      },
    },
  })
}

export async function createSeries(userId: string, input: NewSeries) {
  return prisma.series.create({ data: { userId, ...input } })
}

export async function createWork(userId: string, input: NewWork) {
  return prisma.work.create({ data: { userId, ...input } })
}

export async function addSeriesEntry(userId: string, seriesId: string, input: NewEntry) {
  // Never permit linking another user's work into the current user's series.
  const [series, work] = await Promise.all([
    prisma.series.findFirst({ where: { id: seriesId, userId }, select: { id: true } }),
    prisma.work.findFirst({ where: { id: input.workId, userId }, select: { id: true } }),
  ])
  if (!series || !work) return { error: 'NOT_FOUND' as const, entry: null }

  const existing = await prisma.seriesEntry.findUnique({
    where: { seriesId_workId: { seriesId, workId: input.workId } },
  })
  if (existing) return { error: 'DUPLICATE' as const, entry: null }

  try {
    const entry = await prisma.seriesEntry.create({
      data: { seriesId, workId: input.workId, position: input.position, entryType: input.entryType, isConfirmed: input.isConfirmed },
    })
    return { error: null, entry }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') return { error: 'DUPLICATE' as const, entry: null }
    throw error
  }
}

export async function updateSeries(userId: string, id: string, input: z.infer<typeof updateSeriesSchema>) {
  const result = await prisma.series.updateMany({ where: { id, userId }, data: input })
  return result.count ? getSeries(userId, id) : null
}

export async function updateWork(userId: string, id: string, input: z.infer<typeof updateWorkSchema>) {
  const result = await prisma.work.updateMany({ where: { id, userId }, data: input })
  return result.count ? prisma.work.findFirst({ where: { id, userId } }) : null
}

export async function updateSeriesEntry(userId: string, seriesId: string, id: string, input: z.infer<typeof updateSeriesEntrySchema>) {
  const result = await prisma.seriesEntry.updateMany({ where: { id, seriesId, series: { userId }, work: { userId } }, data: input })
  return result.count ? prisma.seriesEntry.findFirst({ where: { id, seriesId, series: { userId } } }) : null
}

export async function linkEdition(userId: string, workId: string, bookId: string) {
  const [work, book] = await Promise.all([
    prisma.work.findFirst({ where: { id: workId, userId }, select: { id: true } }),
    prisma.book.findFirst({ where: { id: bookId, userId }, select: { id: true } }),
  ])
  if (!work || !book) return null
  return prisma.bookContent.upsert({ where: { bookId_workId: { bookId, workId } }, update: {}, create: { bookId, workId } })
}

export async function unlinkEdition(userId: string, workId: string, bookId: string) {
  const result = await prisma.bookContent.deleteMany({ where: { bookId, workId, book: { userId }, work: { userId } } })
  return result.count > 0
}

export async function removeSeriesEntry(userId: string, seriesId: string, entryId: string) {
  const entry = await prisma.seriesEntry.findFirst({
    where: { id: entryId, seriesId, series: { userId } },
    select: { id: true },
  })
  if (!entry) return false
  await prisma.seriesEntry.delete({ where: { id: entryId } })
  return true
}
