// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { getOwnershipReview, changeOwnership } from '@/lib/series/ownership-service'
import { listSeries } from '@/lib/series/service'
import { exportBackup, restoreBackup } from '@/lib/backup/service'
import { applyCollectionImport } from '@/lib/import/collection-service'
import { collectionFixture } from '../fixtures/collection'
import { OWNERSHIP_DATASET } from '@/lib/series/ownership-decisions'
const url = process.env.DATABASE_URL
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Ownership tests require an enabled disposable localhost database')
let owner: string, other: string
async function fixture(title = 'New Spring', authorName = 'Robert Jordan') {
  const author = await prisma.author.create({ data: { userId: owner, name: authorName } })
  const work = await prisma.work.create({ data: { userId: owner, title, authorName } })
  const series = await prisma.series.create({ data: { userId: owner, name: 'My Series', entries: { create: { workId: work.id } } } })
  const book = await prisma.book.create({ data: { userId: owner, authorId: author.id, title: title === 'New Spring' ? 'The New Spring' : title, source: 'MANUAL', readingStatus: 'READING', coverLocked: true, coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' } })
  return { author, work, series, book }
}
beforeEach(async () => {
  owner = (await prisma.user.create({ data: { email: `ownership-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id
  other = (await prisma.user.create({ data: { email: `ownership-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id
})
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other].filter(Boolean) } } }) })
afterAll(() => prisma.$disconnect())
describe('ownership review against disposable PostgreSQL', () => {
  it('confirms an inferred copy once, preserves physical metadata, and rejects an old replay', async () => {
    const { work, book } = await fixture()
    const before = await prisma.book.findUniqueOrThrow({ where: { id: book.id } })
    const review = await getOwnershipReview(owner, work.id)
    expect(review.copies[0].state).toBe('matched')
    const input = { action: 'link' as const, bookId: book.id, version: review.version }
    const saved = await changeOwnership(owner, work.id, input)
    expect(saved.copies[0].state).toBe('linked')
    await expect(changeOwnership(owner, work.id, input)).rejects.toMatchObject({ status: 409 })
    await changeOwnership(owner, work.id, { ...input, version: saved.version })
    expect(await prisma.bookContent.count({ where: { bookId: book.id, workId: work.id } })).toBe(1)
    expect(await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).toEqual(before)
  })
  it('persists rejection across refreshed checklists and can deliberately allow matching again', async () => {
    const { work, book } = await fixture()
    const review = await getOwnershipReview(owner, work.id)
    const rejected = await changeOwnership(owner, work.id, { action: 'reject', bookId: book.id, version: review.version })
    expect(rejected.copies[0].state).toBe('excluded')
    expect((await listSeries(owner))[0].entries[0].work.editions).toEqual([])
    const reopened = await changeOwnership(owner, work.id, { action: 'allow', bookId: book.id, version: rejected.version })
    expect(reopened.copies[0].state).toBe('matched')
    expect(await prisma.bookContent.count({ where: { bookId: book.id } })).toBe(0)
  })
  it('removes all alias relationships while preserving other omnibus contents and reading history', async () => {
    const { work, book, series } = await fixture('No Life Forsaken', 'Steven Erikson')
    await prisma.series.update({ where: { id: series.id }, data: { name: 'Tales of Witness' } })
    const aliasWork = await prisma.work.create({ data: { userId: owner, title: work.title, authorName: work.authorName } })
    await prisma.series.create({ data: { userId: owner, name: 'Witness', entries: { create: { workId: aliasWork.id } } } })
    const otherWork = await prisma.work.create({ data: { userId: owner, title: 'Other contained work', authorName: work.authorName } })
    await prisma.book.update({ where: { id: book.id }, data: { workId: work.id, contents: { create: [{ workId: work.id }, { workId: aliasWork.id }, { workId: otherWork.id }] } } })
    await prisma.readingSession.create({ data: { bookId: book.id, logs: { create: { requestId: 'ownership-preservation', page: 20, occurredAt: new Date(), note: 'Keep my reading notes' } } } })
    const review = await getOwnershipReview(owner, work.id)
    expect(review.copies[0].links).toHaveLength(3)
    const result = await changeOwnership(owner, work.id, { action: 'unlink', bookId: book.id, version: review.version })
    expect(result.copies[0]).toMatchObject({ state: 'excluded', otherWorks: ['Other contained work'] })
    const physical = await prisma.book.findUniqueOrThrow({ where: { id: book.id }, include: { contents: true, readingSessions: { include: { logs: true } } } })
    expect(physical).toMatchObject({ workId: null, title: book.title, coverLocked: true, coverUrl: book.coverUrl, readingStatus: 'READING' })
    expect(physical.contents.map(content => content.workId)).toEqual([otherWork.id])
    expect(physical.readingSessions[0].logs[0].note).toBe('Keep my reading notes')
    const decisions = await prisma.collectionImport.findUniqueOrThrow({ where: { userId_dataset: { userId: owner, dataset: OWNERSHIP_DATASET } } })
    expect((decisions.report as { exclusions: unknown[] }).exclusions).toHaveLength(2)
  })
  it('refuses stale reviews after a physical copy changes without partially modifying relationships', async () => {
    const { work, book } = await fixture()
    const review = await getOwnershipReview(owner, work.id)
    await prisma.book.update({ where: { id: book.id }, data: { title: 'A manually corrected title' } })
    await expect(changeOwnership(owner, work.id, { action: 'link', bookId: book.id, version: review.version })).rejects.toMatchObject({ status: 409 })
    expect(await prisma.bookContent.count({ where: { bookId: book.id } })).toBe(0)
    expect(await prisma.collectionImport.count({ where: { userId: owner } })).toBe(0)
  })
  it('serializes competing confirmations and rejections from the same review', async () => {
    const { work, book } = await fixture()
    const review = await getOwnershipReview(owner, work.id)
    const results = await Promise.allSettled((['link', 'reject'] as const).map(action => changeOwnership(owner, work.id, { action, bookId: book.id, version: review.version })))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    const failure = results.find(result => result.status === 'rejected') as PromiseRejectedResult
    expect(failure.reason.status).toBe(409)
    const state = (await getOwnershipReview(owner, work.id)).copies[0].state
    expect(['linked', 'excluded']).toContain(state)
    expect(await prisma.bookContent.count({ where: { bookId: book.id } })).toBe(state === 'linked' ? 1 : 0)
  })
  it('holds ambiguous works for explicit choice and never borrows another account’s copies', async () => {
    const { work, book } = await fixture()
    const ambiguous = await prisma.work.create({ data: { userId: owner, title: work.title, authorName: work.authorName } })
    await prisma.series.create({ data: { userId: owner, name: 'Different series', entries: { create: { workId: ambiguous.id } } } })
    const review = await getOwnershipReview(owner, work.id)
    expect(review.copies[0].state).toBe('candidate')
    await expect(getOwnershipReview(other, work.id)).rejects.toMatchObject({ status: 404 })
    const foreignAuthor = await prisma.author.create({ data: { userId: other, name: work.authorName } })
    const foreignBook = await prisma.book.create({ data: { userId: other, authorId: foreignAuthor.id, title: book.title, source: 'MANUAL' } })
    await expect(changeOwnership(owner, work.id, { action: 'link', bookId: foreignBook.id, version: review.version })).rejects.toMatchObject({ status: 404 })
    await changeOwnership(owner, work.id, { action: 'link', bookId: book.id, version: review.version })
    expect((await getOwnershipReview(owner, ambiguous.id)).copies[0].state).toBe('candidate')
    expect(await prisma.bookContent.count({ where: { bookId: foreignBook.id } })).toBe(0)
  })
  it('restores rejected matches with remapped IDs and discards decisions for deleted copies', async () => {
    const { work, book, author } = await fixture()
    let review = await getOwnershipReview(owner, work.id)
    await changeOwnership(owner, work.id, { action: 'reject', bookId: book.id, version: review.version })
    const removed = await prisma.book.create({ data: { userId: owner, authorId: author.id, title: book.title, source: 'MANUAL' } })
    review = await getOwnershipReview(owner, work.id)
    await changeOwnership(owner, work.id, { action: 'reject', bookId: removed.id, version: review.version })
    await prisma.book.delete({ where: { id: removed.id } })
    await restoreBackup(other, await exportBackup(owner))
    const restoredWork = await prisma.work.findFirstOrThrow({ where: { userId: other } })
    const restoredBook = await prisma.book.findFirstOrThrow({ where: { userId: other } })
    const restored = await getOwnershipReview(other, restoredWork.id)
    expect(restored.copies[0]).toMatchObject({ id: restoredBook.id, state: 'excluded' })
    expect(restoredBook.id).not.toBe(book.id)
    const report = (await prisma.collectionImport.findUniqueOrThrow({ where: { userId_dataset: { userId: other, dataset: OWNERSHIP_DATASET } } })).report as { exclusions: { workId: string; bookId: string }[] }
    expect(report.exclusions).toEqual([{ workId: restoredWork.id, bookId: restoredBook.id }])
  })
  it('preserves a removed ownership link when the original collection is imported again', async () => {
    const manifest = collectionFixture()
    await applyCollectionImport(owner, manifest)
    const work = await prisma.work.findFirstOrThrow({ where: { userId: owner, importKey: manifest.series[0].entries[0].sourceKey } })
    const physical = await prisma.book.findFirstOrThrow({ where: { userId: owner } })
    const review = await getOwnershipReview(owner, work.id)
    await changeOwnership(owner, work.id, { action: 'unlink', bookId: physical.id, version: review.version })
    const imported = await applyCollectionImport(owner, manifest)
    expect(imported.issues.some(issue => issue.code === 'OWNERSHIP_REJECTED')).toBe(true)
    expect(await prisma.bookContent.count({ where: { bookId: physical.id, workId: work.id } })).toBe(0)
    expect((await getOwnershipReview(owner, work.id)).copies[0].state).toBe('excluded')
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1)
  })
  it('rejects a review referring to a deleted copy without creating a replacement', async () => {
    const { work, book } = await fixture()
    const review = await getOwnershipReview(owner, work.id)
    await prisma.book.delete({ where: { id: book.id } })
    await expect(changeOwnership(owner, work.id, { action: 'link', bookId: book.id, version: review.version })).rejects.toMatchObject({ status: 404 })
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(0)
  })
})
