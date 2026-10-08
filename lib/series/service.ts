import { prisma } from '@/lib/db'
import type { z } from 'zod'
import { createSeriesSchema, createWorkSchema, createSeriesEntrySchema } from './validation'

type NewSeries = z.infer<typeof createSeriesSchema>
type NewWork = z.infer<typeof createWorkSchema>
type NewEntry = z.infer<typeof createSeriesEntrySchema>

// All reads and mutations are scoped to the signed-in user's catalog.
export async function listSeries(userId: string) {
  return prisma.series.findMany({
    where: { userId },
    include: {
      entries: {
        include: { work: { include: { editions: { where: { userId }, select: { id: true, readingStatus: true, isbn13: true } } } } },
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
        include: { work: { include: { editions: { where: { userId }, select: { id: true, readingStatus: true, isbn13: true } } } } },
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
  if (!series || !work) return { error: 'NOT_FOUND' as const }

  const existing = await prisma.seriesEntry.findUnique({
    where: { seriesId_workId: { seriesId, workId: input.workId } },
  })
  if (existing) return { error: 'DUPLICATE' as const }

  const entry = await prisma.seriesEntry.create({
    data: { seriesId, workId: input.workId, position: input.position, entryType: input.entryType, isConfirmed: input.isConfirmed },
  })
  return { entry }
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
