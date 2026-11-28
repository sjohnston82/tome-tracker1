import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { OWNERSHIP_DATASET } from './ownership-decisions'
import { retryTransaction } from '@/lib/transaction-retry'
import { catalogIdentity } from './catalog-view'
import { MANAGEMENT_DATASET, managementSchema, readManagementState, seriesNameKey, shelfModeSchema } from './management-state'
import type { MergePreview, MergeChoice, MergeResolution } from './merge-types'
const selection = { targetId: z.string().uuid(), sourceId: z.string().uuid(), name: z.string().trim().min(1).max(250) }
export const mergeInput = z.discriminatedUnion('mode', [z.object({ mode: z.literal('preview'), ...selection }).strict(), z.object({ mode: z.literal('apply'), ...selection, version: z.string().regex(/^[a-f0-9]{64}$/), description: z.string().max(4000).nullable(), visibility: shelfModeSchema.optional(), resolutions: z.array(z.object({ groupId: z.string().regex(/^[a-f0-9]{64}$/), mode: z.enum(['combined', 'separate']), entryId: z.string().uuid(), workId: z.string().uuid() }).strict()).max(2000) }).strict()])
export class MergeError extends Error { constructor(public status: number, message: string) { super(message) } }
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
async function load(client: Prisma.TransactionClient, userId: string, input: { targetId: string; sourceId: string; name: string }) {
  if (input.targetId === input.sourceId) throw new MergeError(400, 'Choose two different series.')
  const records = await client.series.findMany({ where: { userId }, include: { entries: { include: { work: { select: { userId: true } } }, orderBy: { id: 'asc' } } }, orderBy: { id: 'asc' } })
  const target = records.find(item => item.id === input.targetId), source = records.find(item => item.id === input.sourceId)
  if (!target || !source) throw new MergeError(404, 'Series not found.')
  if ([...target.entries, ...source.entries].some(entry => entry.work.userId !== userId)) throw new MergeError(409, 'This catalog contains an invalid work relationship. Correct it before merging.')
  const [works, row, books, ownership] = await Promise.all([
    client.work.findMany({ where: { userId }, include: { editions: { where: { userId }, select: { id: true }, orderBy: { id: 'asc' } }, containedIn: { where: { book: { userId } }, select: { bookId: true }, orderBy: { bookId: 'asc' } } }, orderBy: { id: 'asc' } }),
    client.collectionImport.findUnique({ where: { userId_dataset: { userId, dataset: MANAGEMENT_DATASET } }, select: { report: true } }),
    client.book.findMany({ where: { userId }, select: { id: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    client.collectionImport.findUnique({ where: { userId_dataset: { userId, dataset: OWNERSHIP_DATASET } }, select: { report: true } }),
  ])
  const state = readManagementState(row?.report)
  const collision = records.some(item => item.id !== target.id && item.id !== source.id && seriesNameKey(item.name) === seriesNameKey(input.name)) || state.redirects.some(item => seriesNameKey(item.name) === seriesNameKey(input.name) && item.targetId !== target.id && item.targetId !== source.id)
  if (collision) throw new MergeError(409, 'Another series already uses that name. Include it in a separate reviewed merge first.')
  const lookup = new Map(works.map(work => [work.id, work]))
  const groups = new Map<string, MergeChoice[]>()
  for (const record of [target, source]) for (const entry of record.entries) {
    const work = lookup.get(entry.workId)!
    const existing = state.groups.find(group => group.seriesId === record.id && group.mode === 'combined' && group.primaryWorkId === work.id)
    const choices = (existing?.workIds ?? [work.id]).map(id => {
      const variant = lookup.get(id)
      if (!variant) throw new MergeError(409, 'A previously merged work is no longer available. Refresh or repair the catalog first.')
      return { entryId: entry.id, workId: id, seriesId: record.id, seriesName: record.name, title: variant.title, author: variant.authorName, year: variant.publicationYear, position: entry.position?.toString() ?? null, entryType: entry.entryType, confirmed: entry.isConfirmed, owned: new Set([...variant.editions.map(book => book.id), ...variant.containedIn.map(book => book.bookId)]).size }
    })
    const key = catalogIdentity(work.title, work.authorName)
    groups.set(key, [...(groups.get(key) ?? []), ...choices])
  }
  // Work aliases can overlap across the selected series even after title corrections.
  // Coalesce those connected groups before asking for a resolution.
  let joined = true
  while (joined) {
    joined = false
    const items = [...groups.entries()]
    outer: for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (items[i][1].some(a => items[j][1].some(b => a.workId === b.workId))) {
      groups.delete(items[i][0]); groups.delete(items[j][0]); groups.set([items[i][0], items[j][0]].sort().join('|'), [...items[i][1], ...items[j][1]]); joined = true; break outer
    }
  }
  const selected = { targetId: input.targetId, sourceId: input.sourceId, name: input.name }
  const result: MergePreview = { ...selected, version: digest({ input: selected, records, works, books, state, ownership }), targetName: target.name, sourceName: source.name, targetDescription: target.description, sourceDescription: source.description, targetVisibility: state.visibility.find(item => item.seriesId === target.id)?.mode ?? 'automatic', sourceVisibility: state.visibility.find(item => item.seriesId === source.id)?.mode ?? 'automatic', groups: [...groups.entries()].map(([key, choices]) => ({ id: digest(key), choices, needsResolution: choices.length > 1 && (new Set(choices.map(choice => choice.workId)).size > 1 || new Set(choices.map(choice => `${choice.position}:${choice.entryType}`)).size > 1), canSeparate: choices.length > 1 && new Set(choices.map(choice => choice.workId)).size === choices.length })) }
  return { result, state, target, source }
}
export async function seriesMergeOptions(userId: string) {
  return prisma.series.findMany({ where: { userId }, select: { id: true, name: true, _count: { select: { entries: true } } }, orderBy: { name: 'asc' } })
}
export async function previewSeriesMerge(userId: string, input: { targetId: string; sourceId: string; name: string }) {
  return prisma.$transaction(async tx => (await load(tx, userId, input)).result, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 })
}
export async function applySeriesMerge(userId: string, input: Extract<z.infer<typeof mergeInput>, { mode: 'apply' }>) {
  return retryTransaction(() => prisma.$transaction(async tx => {
    const { result: preview, state, target, source } = await load(tx, userId, { targetId: input.targetId, sourceId: input.sourceId, name: input.name })
    if (preview.version !== input.version) throw new MergeError(409, 'The catalog changed. Create a fresh preview before merging.')
    if (preview.targetVisibility !== preview.sourceVisibility && input.visibility === undefined) throw new MergeError(400, 'Choose the retained shelf preference before merging.')
    const resolutions = new Map(input.resolutions.map(item => [item.groupId, item]))
    if (resolutions.size !== input.resolutions.length || input.resolutions.some(item => !preview.groups.some(group => group.id === item.groupId))) throw new MergeError(400, 'Invalid or duplicate conflict choices.')
    const groups = state.groups.filter(group => group.seriesId !== target.id && group.seriesId !== source.id)
    const entries: { seriesId: string; workId: string; position: string | null; entryType: Prisma.SeriesEntryCreateManyInput['entryType']; isConfirmed: boolean }[] = []
    for (const group of preview.groups) {
      const resolution: MergeResolution | undefined = resolutions.get(group.id)
      if (group.needsResolution && !resolution) throw new MergeError(400, 'Choose how to resolve every duplicate or conflict.')
      if (resolution?.mode === 'separate' && !group.canSeparate) throw new MergeError(400, 'This duplicate work needs one explicit order and entry-type choice.')
      const selected = resolution ? group.choices.find(choice => choice.entryId === resolution.entryId && choice.workId === resolution.workId) : [...group.choices].sort((a, b) => Number(b.confirmed) - Number(a.confirmed))[0]
      if (!selected) throw new MergeError(400, 'The selected work does not belong to this preview.')
      const workIds = [...new Set(group.choices.map(choice => choice.workId))]
      const mode = resolution?.mode ?? 'combined'
      const chosen = mode === 'separate' ? group.choices : [selected]
      for (const choice of chosen) entries.push({ seriesId: target.id, workId: choice.workId, position: choice.position, entryType: choice.entryType as Prisma.SeriesEntryCreateManyInput['entryType'], isConfirmed: choice.confirmed || (mode === 'combined' && group.choices.some(other => other.confirmed && other.position === choice.position && other.entryType === choice.entryType)) })
      if (workIds.length > 1) groups.push({ seriesId: target.id, mode, primaryWorkId: selected.workId, workIds })
    }
    const redirects = new Map(state.redirects.map(item => [seriesNameKey(item.name), { ...item, targetId: item.targetId === source.id ? target.id : item.targetId }]))
    for (const name of [target.name, source.name, input.name]) redirects.set(seriesNameKey(name), { name, targetId: target.id })
    const next = managementSchema.parse({ ...state, redirects: [...redirects.values()], groups, visibility: [...state.visibility.filter(item => item.seriesId !== target.id && item.seriesId !== source.id), { seriesId: target.id, mode: input.visibility ?? preview.targetVisibility, revision: randomUUID() }] })
    await tx.seriesEntry.deleteMany({ where: { seriesId: { in: [target.id, source.id] }, series: { userId }, work: { userId } } })
    await tx.seriesEntry.createMany({ data: entries })
    await tx.series.delete({ where: { id: source.id, userId } })
    await tx.series.update({ where: { id: target.id, userId }, data: { name: input.name, description: input.description } })
    await tx.collectionImport.upsert({ where: { userId_dataset: { userId, dataset: MANAGEMENT_DATASET } }, update: { report: next }, create: { userId, dataset: MANAGEMENT_DATASET, manifest: {}, report: next } })
    return { seriesId: target.id, name: input.name, entries: entries.length }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }))
}
