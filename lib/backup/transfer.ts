import { createHash, randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { retryTransaction } from '@/lib/transaction-retry'
import { normalizeToIsbn13 } from '@/lib/books/isbn'
import { formatAuthorName } from '@/lib/books/author-sort'
import { MANAGEMENT_DATASET, remapManagementState } from '@/lib/series/management-state'
import { OWNERSHIP_DATASET, remapOwnershipReport } from '@/lib/series/ownership-decisions'
import { backupSchema, type Backup } from './validation'
import { exportBackup } from './service'
export const TRANSFER_DATASET = 'tome:library-transfer'
export type BookMatch = { sourceId: string; targetId: string }
export class TransferError extends Error {}
const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => [key, canonical(entry)])) : value
export function backupFingerprint(backup: Backup): string {
  const { exportedAt: _exportedAt, ...data } = backup
  const normalized = Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? [...value].sort((a, b) => JSON.stringify(canonical(a)).localeCompare(JSON.stringify(canonical(b)))) : value]))
  return createHash('sha256').update(JSON.stringify(canonical(normalized))).digest('hex')
}
const nameKey = (name: string) => formatAuthorName(name).normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ')
function combinedBook(source: Backup['books'][number], target: Backup['books'][number]) {
  return { ...source, id: target.id, authorId: target.authorId, isbn13: source.isbn13 ?? target.isbn13, isbn10: source.isbn10 ?? target.isbn10, publisher: source.publisher ?? target.publisher, publicationYear: source.publicationYear ?? target.publicationYear, seriesName: source.seriesName ?? target.seriesName, seriesNumber: source.seriesNumber ?? target.seriesNumber, coverUrl: target.coverLocked && !source.coverLocked ? target.coverUrl : source.coverLocked ? source.coverUrl : source.coverUrl ?? target.coverUrl, coverLocked: source.coverLocked || target.coverLocked, tags: [...new Set([...target.tags, ...source.tags])], genres: [...new Set([...target.genres, ...source.genres])], source: target.source, createdAt: target.createdAt, updatedAt: target.updatedAt }
}
export function previewLibraryTransfer(input: unknown, target: Backup, matches: BookMatch[] = []) {
  const source = backupSchema.parse(input)
  const receipt = target.imports.find(row => row.dataset === TRANSFER_DATASET)
  const sourceHash = backupFingerprint(source), targetHash = backupFingerprint(target)
  if (receipt && (receipt.report as { sourceHash?: string })?.sourceHash === sourceHash) return { sourceHash, targetHash, alreadyApplied: true, matches, conflicts: [] as { kind: string; sourceId: string; targetId: string; fields: string[] }[], addedBooks: 0, reusedBooks: matches.length, finalBooks: target.books.length, source }
  // This workflow upgrades a legacy online library. Existing modern catalogs need a
  // separate, reviewed graph merge; never discard or silently replace their decisions.
  if (target.works.length || target.series.length || target.entries.length || target.contents.length || target.sessions.length || target.logs.length || target.imports.length) throw new TransferError('Destination contains catalog or reading data. A reviewed catalog merge is required instead of this legacy transfer.')
  if (source.imports.some(row => row.dataset === TRANSFER_DATASET)) throw new TransferError('Source already contains a transfer receipt. Review its migration lineage before transferring again.')
  if (new Set(matches.map(match => match.sourceId)).size !== matches.length || new Set(matches.map(match => match.targetId)).size !== matches.length) throw new TransferError('Book matches must be one-to-one.')
  const conflicts: { kind: string; sourceId: string; targetId: string; fields: string[] }[] = []
  for (const match of matches) {
    const from = source.books.find(book => book.id === match.sourceId), to = target.books.find(book => book.id === match.targetId)
    if (!from || !to) throw new TransferError('A selected book match no longer exists.')
    const sourceAuthor = source.authors.find(author => author.id === from.authorId)!, targetAuthor = target.authors.find(author => author.id === to.authorId)!
    if (nameKey(sourceAuthor.name) !== nameKey(targetAuthor.name)) throw new TransferError('Matched physical copies have different authors; review the match first.')
    const a = normalizeToIsbn13(from.isbn13 ?? from.isbn10 ?? ''), b = normalizeToIsbn13(to.isbn13 ?? to.isbn10 ?? '')
    if (a && b && a !== b) throw new TransferError('Matched physical copies have conflicting ISBNs; keep them separate or correct their metadata first.')
    const proposed = combinedBook(from, to)
    const fields = Object.keys(proposed).filter(key => !['id','authorId','workId','createdAt','updatedAt','importKey'].includes(key) && JSON.stringify(proposed[key as keyof typeof proposed]) !== JSON.stringify(to[key as keyof typeof to]))
    if (fields.length) conflicts.push({ kind: 'book', sourceId: from.id, targetId: to.id, fields })
  }
  for (const author of source.authors) {
    const existing = target.authors.filter(item => nameKey(item.name) === nameKey(author.name))
    if (existing.length > 1) throw new TransferError('Ambiguous destination author names require review.')
    if (existing[0]) {
      const fields = (['bio','photoUrl','externalSource','externalId'] as const).filter(key => author[key] !== null && existing[0][key] !== null && author[key] !== existing[0][key])
      if (fields.length) conflicts.push({ kind: 'author', sourceId: author.id, targetId: existing[0].id, fields })
    }
  }
  // Known ISBN duplicates must be explicitly mapped, even when titles differ.
  for (const from of source.books) for (const to of target.books) {
    const a = normalizeToIsbn13(from.isbn13 ?? from.isbn10 ?? ''), b = normalizeToIsbn13(to.isbn13 ?? to.isbn10 ?? '')
    const titleKey = (title: string) => title.normalize('NFKC').toLowerCase().replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[^\p{L}\p{N}]+/gu,' ').trim()
    const sameIdentity = titleKey(from.title) === titleKey(to.title) && nameKey(source.authors.find(author => author.id === from.authorId)!.name) === nameKey(target.authors.find(author => author.id === to.authorId)!.name)
    if (sameIdentity && !(a && b && a !== b) && !matches.some(match => match.sourceId === from.id && match.targetId === to.id)) throw new TransferError('A possible duplicate physical copy needs an explicit match before transferring.')
    if (a && a === b && !matches.some(match => match.sourceId === from.id && match.targetId === to.id)) throw new TransferError('An existing ISBN matches a source book. Explicitly review that copy before transferring.')
  }
  return { sourceHash, targetHash, alreadyApplied: false, matches, conflicts, addedBooks: source.books.length - matches.length, reusedBooks: matches.length, finalBooks: target.books.length + source.books.length - matches.length, source }
}
export async function applyLibraryTransfer(userId: string, input: unknown, options: { expectedTargetHash: string; matches: BookMatch[]; approveLocalMetadata: boolean; expectedEmail?: string }) {
  return retryTransaction(() => prisma.$transaction(async tx => {
    const account = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true } })
    if (!account) throw new TransferError('Destination account not found.')
    if (options.expectedEmail && account.email.toLowerCase() !== options.expectedEmail.toLowerCase()) throw new TransferError('Destination account identity changed. Review the destination again.')
    const target = await exportBackup(userId, tx), plan = previewLibraryTransfer(input, target, options.matches)
    if (plan.alreadyApplied) return { alreadyApplied: true, books: target.books.length, sourceHash: plan.sourceHash, mapping: null }
    if (plan.targetHash !== options.expectedTargetHash) throw new TransferError('The online library changed. Prepare a new preview before transferring.')
    if (plan.conflicts.length && !options.approveLocalMetadata) throw new TransferError('Metadata differences require explicit approval before reusing online records.')
    const source = plan.source
    const authors = new Map<string,string>(), works = new Map<string,string>(), books = new Map<string,string>(), series = new Map<string,string>(), sessions = new Map<string,string>()
    for (const [rows, mapping] of [[source.authors, authors],[source.works,works],[source.books,books],[source.series,series],[source.sessions,sessions]] as const) for (const row of rows) mapping.set(row.id, randomUUID())
    const newAuthors: Prisma.AuthorCreateManyInput[] = []
    for (const author of source.authors) {
      const existing = target.authors.find(item => nameKey(item.name) === nameKey(author.name))
      if (existing) {
        authors.set(author.id, existing.id)
        const data = { bio: author.bio ?? existing.bio, photoUrl: author.photoUrl ?? existing.photoUrl, externalSource: author.externalSource ?? existing.externalSource, externalId: author.externalId ?? existing.externalId }
        if (Object.entries(data).some(([key,value]) => value !== existing[key as keyof typeof existing])) await tx.author.update({ where: { id: existing.id, userId }, data })
      } else newAuthors.push({ ...author, id: authors.get(author.id)!, userId })
    }
    await tx.author.createMany({ data: newAuthors })
    await tx.work.createMany({ data: source.works.map(work => ({ ...work, id: works.get(work.id)!, userId })) })
    await tx.series.createMany({ data: source.series.map(item => ({ ...item, id: series.get(item.id)!, userId })) })
    const newBooks: Prisma.BookCreateManyInput[] = []
    for (const book of source.books) {
      const match = options.matches.find(item => item.sourceId === book.id), existing = match && target.books.find(item => item.id === match.targetId)
      if (existing) {
        books.set(book.id, existing.id)
        const { id: _id, createdAt: _created, updatedAt: _updated, ...data } = combinedBook(book, existing)
        await tx.book.update({ where: { id: existing.id, userId }, data: { ...data, authorId: authors.get(book.authorId)!, workId: book.workId ? works.get(book.workId)! : existing.workId } })
      } else newBooks.push({ ...book, id: books.get(book.id)!, userId, authorId: authors.get(book.authorId)!, workId: book.workId ? works.get(book.workId)! : null })
    }
    await tx.book.createMany({ data: newBooks })
    await tx.seriesEntry.createMany({ data: source.entries.map(entry => ({ ...entry, id: randomUUID(), seriesId: series.get(entry.seriesId)!, workId: works.get(entry.workId)! })) })
    await tx.bookContent.createMany({ data: source.contents.map(item => ({ bookId: books.get(item.bookId)!, workId: works.get(item.workId)! })) })
    await tx.readingSession.createMany({ data: source.sessions.map(item => ({ ...item, id: sessions.get(item.id)!, bookId: books.get(item.bookId)! })) })
    await tx.readingLog.createMany({ data: source.logs.map(item => ({ ...item, id: randomUUID(), sessionId: sessions.get(item.sessionId)! })) })
    await tx.collectionImport.createMany({ data: source.imports.map(item => ({ ...item, id: randomUUID(), userId, manifest: item.manifest === null ? Prisma.JsonNull : item.manifest, report: item.dataset === MANAGEMENT_DATASET ? remapManagementState(item.report, series, works) : item.dataset === OWNERSHIP_DATASET ? remapOwnershipReport(item.report, works, books) : item.report === null ? Prisma.JsonNull : item.report })) })
    const after = await exportBackup(userId, tx)
    if (after.books.length !== plan.finalBooks || after.works.length !== source.works.length || after.series.length !== source.series.length || after.entries.length !== source.entries.length || after.contents.length !== source.contents.length || after.sessions.length !== source.sessions.length || after.logs.length !== source.logs.length) throw new TransferError('Transfer reconciliation failed; all changes were rolled back.')
    // Validate the complete source graph, not just record counts.
    for (const book of source.books) {
      const saved = after.books.find(item => item.id === books.get(book.id))!
      const existing = options.matches.find(item => item.sourceId === book.id)
      const intended = existing ? combinedBook(book, target.books.find(item => item.id === existing.targetId)!) : book
      for (const key of ['title','readingStatus','coverUrl','coverLocked','publicationYear','isbn13','isbn10','publisher','seriesName','seriesNumber','tags','genres','importKey'] as const) if (JSON.stringify(saved[key]) !== JSON.stringify(intended[key])) throw new TransferError(`Book ${key} did not reconcile; all changes were rolled back.`)
    }
    for (const item of source.logs) if (!after.logs.some(saved => saved.sessionId === sessions.get(item.sessionId) && saved.requestId === item.requestId && saved.page === item.page && saved.note === item.note && saved.occurredAt === item.occurredAt && saved.isCompletion === item.isCompletion)) throw new TransferError('Reading history did not reconcile; all changes were rolled back.')
    const equalFields = (saved: unknown, intended: unknown) => JSON.stringify(canonical(saved)) === JSON.stringify(canonical(intended))
    for (const work of source.works) if (!equalFields(after.works.find(item => item.id === works.get(work.id)), { ...work, id: works.get(work.id) })) throw new TransferError('Work metadata failed reconciliation.')
    for (const item of source.series) if (!equalFields(after.series.find(saved => saved.id === series.get(item.id)), { ...item, id: series.get(item.id) })) throw new TransferError('Series metadata failed reconciliation.')
    for (const item of source.entries) if (!after.entries.some(saved => saved.seriesId === series.get(item.seriesId) && saved.workId === works.get(item.workId) && saved.position === item.position && saved.entryType === item.entryType && saved.isConfirmed === item.isConfirmed)) throw new TransferError('Series ordering failed reconciliation.')
    for (const item of source.contents) if (!after.contents.some(saved => saved.bookId === books.get(item.bookId) && saved.workId === works.get(item.workId))) throw new TransferError('Ownership relationships failed reconciliation.')
    for (const item of source.sessions) if (!equalFields(after.sessions.find(saved => saved.id === sessions.get(item.id)), { ...item, id: sessions.get(item.id), bookId: books.get(item.bookId) })) throw new TransferError('Reading session failed reconciliation.')
    for (const item of source.imports) {
      const report = item.dataset === MANAGEMENT_DATASET ? remapManagementState(item.report, series, works) : item.dataset === OWNERSHIP_DATASET ? remapOwnershipReport(item.report, works, books) : item.report
      const saved = after.imports.find(row => row.dataset === item.dataset)
      if (!saved || !equalFields(saved.manifest, item.manifest) || !equalFields(saved.report, report)) throw new TransferError('Saved review decisions failed reconciliation.')
    }
    await tx.collectionImport.create({ data: { userId, dataset: TRANSFER_DATASET, manifest: { sourceHash: plan.sourceHash }, report: { version: 1, sourceHash: plan.sourceHash, transferredAt: new Date().toISOString(), addedBooks: plan.addedBooks, reusedBooks: plan.reusedBooks, finalBooks: plan.finalBooks } } })
    return { alreadyApplied: false, books: after.books.length, sourceHash: plan.sourceHash, mapping: Object.fromEntries([['authors',authors],['works',works],['books',books],['series',series],['sessions',sessions]].map(([key,map]) => [key,Object.fromEntries(map as Map<string,string>)])) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 }))
}
