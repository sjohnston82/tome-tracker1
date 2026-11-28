// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { previewSeriesMerge, applySeriesMerge, seriesMergeOptions } from '@/lib/series/merge-service'
import { getMetadataReview } from '@/lib/review/service'
import { getOwnershipReview } from '@/lib/series/ownership-service'
import { listSeries } from '@/lib/series/service'
import { exportBackup, restoreBackup } from '@/lib/backup/service'
import { applyCollectionImport } from '@/lib/import/collection-service'
import { collectionFixture } from '../fixtures/collection'
const url = process.env.DATABASE_URL
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Merge tests require an enabled disposable localhost database')
let owner: string, other: string
beforeEach(async () => { owner = (await prisma.user.create({ data: { email: `merge-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id; other = (await prisma.user.create({ data: { email: `merge-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id })
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other].filter(Boolean) } } }) })
afterAll(() => prisma.$disconnect())
async function fixture(sameWork = false) {
  const author = await prisma.author.create({ data: { userId: owner, name: 'Steven Erikson' } })
  const first = await prisma.work.create({ data: { userId: owner, title: 'No Life Forsaken', authorName: author.name, publicationYear: 2025 } })
  const second = sameWork ? first : await prisma.work.create({ data: { userId: owner, title: first.title, authorName: author.name, publicationYear: 2026 } })
  const target = await prisma.series.create({ data: { userId: owner, name: 'Tales of Witness', description: 'Manually corrected description', entries: { create: { workId: first.id, position: 2, isConfirmed: true } } } })
  const source = await prisma.series.create({ data: { userId: owner, name: 'Witness', description: 'Alternate description', entries: { create: { workId: second.id, position: 3, entryType: 'NOVELLA', isConfirmed: true } } } })
  const book = await prisma.book.create({ data: { userId: owner, authorId: author.id, title: first.title, source: 'MANUAL', readingStatus: 'READING', coverLocked: true, workId: second.id, contents: { create: { workId: second.id } } } })
  await prisma.readingSession.create({ data: { bookId: book.id, logs: { create: { requestId: 'keep-log', page: 20, occurredAt: new Date(), note: 'Keep this note' } } } })
  return { first, second, target, source, book, input: { targetId: target.id, sourceId: source.id, name: target.name } }
}
async function proposal(f: Awaited<ReturnType<typeof fixture>>, mode: 'combined' | 'separate' = 'combined') {
  const preview = await previewSeriesMerge(owner, f.input)
  return { mode: 'apply' as const, ...f.input, version: preview.version, description: f.target.description, resolutions: preview.groups.filter(group => group.needsResolution).map(group => ({ groupId: group.id, mode, entryId: group.choices[0].entryId, workId: group.choices[0].workId })) }
}
describe('atomic series cleanup', () => {
  it('previews without changes and merges duplicate works while preserving books, metadata and ownership provenance', async () => {
    const f = await fixture(), before = await exportBackup(owner), input = await proposal(f)
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(2)
    expect((await previewSeriesMerge(owner, f.input)).groups[0].needsResolution).toBe(true)
    await applySeriesMerge(owner, input)
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(1)
    expect(await prisma.seriesEntry.count({ where: { series: { userId: owner } } })).toBe(1)
    const ownership = await getOwnershipReview(owner, f.first.id)
    expect(ownership.copies.find(copy => copy.id === f.book.id)?.links.map(link => link.workId)).toEqual([f.second.id, f.second.id])
    const after = await exportBackup(owner)
    expect(after.books).toEqual(before.books); expect(after.works).toEqual(before.works); expect(after.logs).toEqual(before.logs); expect(after.contents).toEqual(before.contents)
    const catalog = await listSeries(owner)
    expect(catalog[0]).toMatchObject({ id: f.target.id, name: 'Tales of Witness', entries: [{ position: '2', isConfirmed: true }] })
    expect(catalog[0].entries[0].ownershipWorkIds?.sort()).toEqual([f.first.id, f.second.id].sort())
    expect(catalog[0].entries[0].ownershipLinks).toContainEqual({ bookId: f.book.id, workId: f.second.id, source: 'edition' })
    await expect(applySeriesMerge(owner, input)).rejects.toMatchObject({ status: 404 })
  })
  it('keeps explicitly distinct works separate despite identical titles and author credits', async () => {
    const f = await fixture()
    await applySeriesMerge(owner, await proposal(f, 'separate'))
    const catalog = await listSeries(owner)
    expect(catalog[0].entries).toHaveLength(2)
    expect(catalog[0].entries.map(entry => entry.position)).toEqual(['2', '3'])
    expect(catalog[0].entries.map(entry => entry.work.publicationYear).sort()).toEqual([2025, 2026])
  })
  it('rejects incomplete or forged conflict choices without partial writes', async () => {
    const f = await fixture(), input = await proposal(f)
    await expect(applySeriesMerge(owner, { ...input, resolutions: [] })).rejects.toMatchObject({ status: 400 })
    await expect(applySeriesMerge(owner, { ...input, resolutions: [{ ...input.resolutions[0], workId: crypto.randomUUID() }] })).rejects.toMatchObject({ status: 400 })
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(2)
    expect(await prisma.seriesEntry.count({ where: { series: { userId: owner } } })).toBe(2)
  })
  it('requires an order choice for duplicate memberships of the same work and rejects keep-both', async () => {
    const f = await fixture(true), input = await proposal(f, 'separate')
    await expect(applySeriesMerge(owner, input)).rejects.toMatchObject({ status: 400 })
    await applySeriesMerge(owner, { ...input, resolutions: input.resolutions.map(item => ({ ...item, mode: 'combined' })) })
    expect(await prisma.seriesEntry.count({ where: { series: { userId: owner } } })).toBe(1)
  })
  it('rejects stale previews and third-series name collisions', async () => {
    const f = await fixture(), input = await proposal(f)
    await prisma.work.update({ where: { id: f.second.id }, data: { publicationYear: 2027 } })
    await expect(applySeriesMerge(owner, input)).rejects.toMatchObject({ status: 409 })
    await prisma.series.create({ data: { userId: owner, name: 'Existing name' } })
    await expect(previewSeriesMerge(owner, { ...f.input, name: 'EXISTING NAME' })).rejects.toMatchObject({ status: 409 })
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(3)
  })
  it('does not disclose or merge another account’s series or mixed-owner work relationships', async () => {
    const f = await fixture()
    expect(await seriesMergeOptions(other)).toEqual([])
    await expect(previewSeriesMerge(other, f.input)).rejects.toMatchObject({ status: 404 })
    const foreign = await prisma.work.create({ data: { userId: other, title: 'Foreign', authorName: 'Other' } })
    await prisma.seriesEntry.create({ data: { seriesId: f.source.id, workId: foreign.id } })
    await expect(previewSeriesMerge(owner, f.input)).rejects.toMatchObject({ status: 409 })
    expect(await prisma.work.findUnique({ where: { id: foreign.id } })).not.toBeNull()
  })
  it('allows one winning merge from competing previews and retains a chosen custom canonical name', async () => {
    const f = await fixture(), input = await proposal(f)
    const custom = await previewSeriesMerge(owner, { ...f.input, name: 'My Witness Shelf' })
    const results = await Promise.allSettled([applySeriesMerge(owner, input), applySeriesMerge(owner, { ...input, name: custom.name, version: custom.version })])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(1)
    const saved = await prisma.series.findFirstOrThrow({ where: { userId: owner } })
    expect((await listSeries(owner))[0].name).toBe(saved.name)
  })
  it('restores merged work aliases and redirects with fresh IDs', async () => {
    const f = await fixture()
    await applySeriesMerge(owner, await proposal(f))
    await restoreBackup(other, await exportBackup(owner))
    const catalog = await listSeries(other)
    expect(catalog).toHaveLength(1); expect(catalog[0].entries).toHaveLength(1)
    expect(catalog[0].entries[0].ownershipWorkIds).toHaveLength(2)
    expect(catalog[0].entries[0].work.editions.length + catalog[0].entries[0].work.containedIn.length).toBeGreaterThan(0)
    expect(catalog[0].id).not.toBe(f.target.id)
  })
  it('routes reimports to the merged series without restoring discarded ordering or duplicate entries', async () => {
    const manifest = collectionFixture(); await applyCollectionImport(owner, manifest)
    const original = await prisma.series.findFirstOrThrow({ where: { userId: owner } })
    const changedEntry = await prisma.seriesEntry.findFirstOrThrow({ where: { seriesId: original.id } })
    await prisma.seriesEntry.update({ where: { id: changedEntry.id }, data: { position: 8.5, isConfirmed: true } })
    const target = await prisma.series.create({ data: { userId: owner, name: 'My corrected series' } })
    const preview = await previewSeriesMerge(owner, { targetId: target.id, sourceId: original.id, name: target.name })
    await applySeriesMerge(owner, { mode: 'apply', targetId: target.id, sourceId: original.id, name: target.name, version: preview.version, description: null, resolutions: [] })
    await applyCollectionImport(owner, manifest)
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(1)
    expect(await prisma.seriesEntry.count({ where: { seriesId: target.id } })).toBe(2)
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1)
    const review = await getMetadataReview(owner)
    expect(review.items.some(item => item.code === 'ORDER_CONFLICT' && item.current.includes('8.5'))).toBe(true)
  })
})
