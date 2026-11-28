import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { retryTransaction } from '@/lib/transaction-retry'
import { listSeries } from './service'
import { ownershipIdentity } from './catalog-view'
import { OWNERSHIP_DATASET, readOwnershipExclusions } from './ownership-decisions'
import type { OwnershipReview, OwnershipCopy } from './ownership-types'
export const ownershipInput = z.object({ action: z.enum(['link', 'unlink', 'reject', 'allow']), bookId: z.string().uuid(), version: z.string().regex(/^[a-f0-9]{64}$/) }).strict()
export class OwnershipError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
async function load(client: Prisma.TransactionClient, userId: string, workId: string) {
  const work = await client.work.findFirst({ where: { id: workId, userId }, select: { id: true, title: true, authorName: true } })
  if (!work) throw new OwnershipError(404, 'Work not found.')
  const catalog = await listSeries(userId, client)
  const related = new Set([workId])
  for (const series of catalog) for (const entry of series.entries) if ((entry.ownershipWorkIds ?? [entry.work.id]).includes(workId)) for (const id of entry.ownershipWorkIds ?? [entry.work.id]) related.add(id)
  const [works, books, row] = await Promise.all([
    client.work.findMany({ where: { userId }, select: { id: true, title: true, authorName: true, updatedAt: true }, orderBy: { id: 'asc' } }),
    client.book.findMany({ where: { userId }, select: { id: true, title: true, isbn13: true, readingStatus: true, workId: true, updatedAt: true, author: { select: { name: true } }, contents: { where: { work: { userId } }, select: { workId: true }, orderBy: { workId: 'asc' } } }, orderBy: { id: 'asc' } }),
    client.collectionImport.findUnique({ where: { userId_dataset: { userId, dataset: OWNERSHIP_DATASET } }, select: { report: true } }),
  ])
  const exclusions = row ? readOwnershipExclusions(row.report) : []
  const relatedIds = works.filter(item => related.has(item.id)).map(item => item.id)
  const suggested = new Set(catalog.flatMap(series => series.entries).filter(entry => (entry.ownershipWorkIds ?? [entry.work.id]).some(id => related.has(id))).flatMap(entry => (entry.ownershipLinks ?? []).filter(link => link.source === 'match').map(link => link.bookId)))
  const names = new Map(works.map(item => [item.id, item.title]))
  const copies: OwnershipCopy[] = books.map(book => {
    const links: OwnershipCopy['links'] = []
    if (book.workId && related.has(book.workId) && names.has(book.workId)) links.push({ workId: book.workId, title: names.get(book.workId)!, source: 'edition' })
    for (const content of book.contents) if (related.has(content.workId)) links.push({ workId: content.workId, title: names.get(content.workId)!, source: 'content' })
    const excluded = exclusions.some(pair => pair.bookId === book.id && related.has(pair.workId))
    const sameIdentity = ownershipIdentity(book.title, book.author.name) === ownershipIdentity(work.title, work.authorName)
    const state = links.length ? 'linked' : excluded ? 'excluded' : suggested.has(book.id) ? 'matched' : 'candidate'
    return { id: book.id, title: book.title, author: book.author.name, isbn13: book.isbn13, readingStatus: book.readingStatus, state, links, otherWorks: [...new Set([book.workId, ...book.contents.map(content => content.workId)].filter((id): id is string => !!id && !related.has(id) && names.has(id)).map(id => names.get(id)!))], reason: state === 'linked' ? 'Saved relationship to this work.' : state === 'excluded' ? 'You rejected this match. Automatic matching is blocked.' : state === 'matched' ? 'Unlinked library copy matches this title and author. Confirmation is still needed.' : sameIdentity ? 'Possible identity match; conflicting works or existing links require a manual choice.' : 'No automatic match. Select only if this copy contains the work.' }
  })
  const version = createHash('sha256').update(JSON.stringify({ workId, relatedIds, works, books, exclusions, copies })).digest('hex')
  const review: OwnershipReview = { work: { id: work.id, title: work.title, author: work.authorName }, version, copies }
  return { review, relatedIds, exclusions }
}
export async function getOwnershipReview(userId: string, workId: string) {
  return prisma.$transaction(async tx => (await load(tx, userId, workId)).review, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 })
}
export async function changeOwnership(userId: string, workId: string, input: z.infer<typeof ownershipInput>) {
  return retryTransaction(() => prisma.$transaction(async tx => {
    const state = await load(tx, userId, workId)
    const copy = state.review.copies.find(book => book.id === input.bookId)
    if (!copy) throw new OwnershipError(404, 'Physical copy not found.')
    if (state.review.version !== input.version) throw new OwnershipError(409, 'Your library changed. Refresh this review before saving.')
    if ((input.action === 'unlink' && copy.state !== 'linked') || (input.action === 'reject' && copy.state !== 'matched' && copy.state !== 'candidate') || (input.action === 'allow' && copy.state !== 'excluded')) throw new OwnershipError(409, 'This ownership state changed. Refresh this review before saving.')
    if (input.action === 'unlink') {
      await tx.book.updateMany({ where: { id: input.bookId, userId, workId: { in: state.relatedIds } }, data: { workId: null } })
      await tx.bookContent.deleteMany({ where: { bookId: input.bookId, workId: { in: state.relatedIds }, book: { userId }, work: { userId } } })
    }
    if (input.action === 'link') await tx.bookContent.upsert({ where: { bookId_workId: { bookId: input.bookId, workId } }, update: {}, create: { bookId: input.bookId, workId } })
    const remaining = state.exclusions.filter(pair => !(pair.bookId === input.bookId && state.relatedIds.includes(pair.workId)))
    if (input.action === 'unlink' || input.action === 'reject') for (const id of state.relatedIds) remaining.push({ bookId: input.bookId, workId: id })
    await tx.collectionImport.upsert({ where: { userId_dataset: { userId, dataset: OWNERSHIP_DATASET } }, update: { report: { version: 1, exclusions: remaining } }, create: { userId, dataset: OWNERSHIP_DATASET, manifest: {}, report: { version: 1, exclusions: remaining } } })
    return (await load(tx, userId, workId)).review
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }))
}
