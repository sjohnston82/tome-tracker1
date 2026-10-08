// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { applyCollectionImport, previewCollectionImport } from '@/lib/import/collection-service'
import { collectionFixture, bookKey, workKey } from '../fixtures/collection'
import { getSeries, addSeriesEntry } from '@/lib/series/service'

const url = process.env.DATABASE_URL
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Database tests require RUN_DATABASE_TESTS=true and a disposable localhost database')

describe('collection import against disposable PostgreSQL', () => {
  let owner: string
  let other: string
  beforeAll(async () => {
    owner = (await prisma.user.create({ data: { email: `collection-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id
    other = (await prisma.user.create({ data: { email: `other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id
  })
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } })
    await prisma.$disconnect()
  })
  it('previews without writing, imports, reruns, and preserves manual corrections', async () => {
    const manifest = collectionFixture()
    expect((await previewCollectionImport(owner, manifest)).summary.newOwned).toBe(1)
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(0)
    const first = await applyCollectionImport(owner, manifest)
    expect(first).toMatchObject({ applied: true, actualOwned: 1, actualStatuses: { READ: 1 }, reconciled: true })
    expect(await prisma.work.count({ where: { userId: owner } })).toBe(2)
    expect(await prisma.bookContent.count({ where: { book: { userId: owner } } })).toBe(1)
    expect((await applyCollectionImport(owner, manifest)).summary.newOwned).toBe(0)
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1)
    const edition = await prisma.book.findUniqueOrThrow({ where: { userId_importKey: { userId: owner, importKey: bookKey } } })
    await prisma.book.update({ where: { id: edition.id }, data: { title: 'Corrected title', readingStatus: 'UNREAD', publicationYear: 2005 } })
    const work = await prisma.work.findUniqueOrThrow({ where: { userId_importKey: { userId: owner, importKey: workKey } } })
    await prisma.work.update({ where: { id: work.id }, data: { title: 'Corrected work', publicationYear: 1989 } })
    const result = await applyCollectionImport(owner, manifest)
    expect(result).toMatchObject({ applied: true, actualOwned: 1, actualStatuses: { UNREAD: 1 }, reconciled: false })
    expect(await prisma.book.findUnique({ where: { id: edition.id } })).toMatchObject({ title: 'Corrected title', publicationYear: 2005 })
    expect(await prisma.work.findUnique({ where: { id: work.id } })).toMatchObject({ title: 'Corrected work', publicationYear: 1989 })
  })
  it('isolates per-user imports, series reads, and work linking', async () => {
    const result = await applyCollectionImport(other, collectionFixture())
    expect(result.summary.newOwned).toBe(1)
    const series = await prisma.series.findFirstOrThrow({ where: { userId: owner } })
    expect(await getSeries(other, series.id)).toBeNull()
    const otherWork = await prisma.work.findFirstOrThrow({ where: { userId: other } })
    expect(await addSeriesEntry(owner, series.id, { workId: otherWork.id, position: 2, entryType: 'MAIN', isConfirmed: true })).toMatchObject({ error: 'NOT_FOUND' })
  })
  it('rejects invalid manifests without partial writes', async () => {
    const manifest = collectionFixture()
    manifest.expected.owned = 2
    const before = await prisma.book.count()
    await expect(applyCollectionImport(owner, manifest)).rejects.toThrow()
    expect(await prisma.book.count()).toBe(before)
  })

  it('reconciles a 245-edition import and reruns without creating duplicates', async () => {
    const user = await prisma.user.create({ data: { email: `large-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })
    try {
      const manifest = collectionFixture()
      manifest.books = Array.from({ length: 245 }, (_, index) => ({ ...manifest.books[0], sourceKey: 'book:' + index.toString(16).padStart(64, '0'), title: `Synthetic physical edition ${index}`, readingStatus: index < 150 ? 'READ' as const : index === 150 ? 'READING' as const : 'UNREAD' as const }))
      manifest.expected = { owned: 245, statuses: { READ: 150, READING: 1, UNREAD: 94, UNKNOWN: 0 } }
      manifest.series[0].entries[0].ownedSourceKeys = [manifest.books[0].sourceKey]
      expect(await applyCollectionImport(user.id, manifest)).toMatchObject({ actualOwned: 245, actualStatuses: manifest.expected.statuses, reconciled: true })
      expect((await applyCollectionImport(user.id, manifest)).summary.newOwned).toBe(0)
      expect(await prisma.book.count({ where: { userId: user.id } })).toBe(245)
    } finally { await prisma.user.delete({ where: { id: user.id } }) }
  }, 60000)
})
