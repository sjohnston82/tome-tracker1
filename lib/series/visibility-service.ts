import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { retryTransaction } from '@/lib/transaction-retry'
import { listSeries } from './service'
import { MANAGEMENT_DATASET, readManagementState, shelfModeSchema, managementSchema } from './management-state'
export const visibilityInput = z.object({ mode: shelfModeSchema, version: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
export class VisibilityError extends Error { constructor(public status: number, message: string) { super(message) } }
export async function setSeriesVisibility(userId: string, id: string, input: z.infer<typeof visibilityInput>) {
  return retryTransaction(() => prisma.$transaction(async tx => {
    if (!await tx.series.findFirst({ where: { id, userId }, select: { id: true } })) throw new VisibilityError(404, 'Series not found.')
    const catalog = await listSeries(userId, tx)
    const series = catalog.find(item => (item.sourceSeriesIds ?? [item.id]).includes(id))
    if (!series) throw new VisibilityError(404, 'Series not found.')
    if (series.visibilityVersion !== input.version) throw new VisibilityError(409, 'This shelf preference changed. Refresh Series before saving.')
    const row = await tx.collectionImport.findUnique({ where: { userId_dataset: { userId, dataset: MANAGEMENT_DATASET } }, select: { report: true } })
    const state = readManagementState(row?.report), ids = series.sourceSeriesIds ?? [series.id], revision = randomUUID()
    const next = managementSchema.parse({ ...state, visibility: [...state.visibility.filter(item => !ids.includes(item.seriesId)), ...ids.map(seriesId => ({ seriesId, mode: input.mode, revision }))] })
    await tx.collectionImport.upsert({ where: { userId_dataset: { userId, dataset: MANAGEMENT_DATASET } }, update: { report: next }, create: { userId, dataset: MANAGEMENT_DATASET, manifest: {}, report: next } })
    return { seriesId: series.id, mode: input.mode }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }))
}
