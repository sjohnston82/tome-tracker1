// @vitest-environment node
import { beforeEach, afterEach, afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { listSeries } from '@/lib/series/service'
import { setSeriesVisibility } from '@/lib/series/visibility-service'
import { previewSeriesMerge, applySeriesMerge } from '@/lib/series/merge-service'
import { exportBackup, restoreBackup } from '@/lib/backup/service'
import { applyCollectionImport } from '@/lib/import/collection-service'
import { collectionFixture } from '../fixtures/collection'
import { isSeriesVisible } from '@/lib/series/shelf-preference'
const url = process.env.DATABASE_URL
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Visibility tests require an enabled disposable localhost database')
let owner: string, other: string
beforeEach(async () => { owner = (await prisma.user.create({ data: { email: `visibility-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id; other = (await prisma.user.create({ data: { email: `visibility-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id })
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other].filter(Boolean) } } }) })
afterAll(() => prisma.$disconnect())
const prefs = { showHidden: false, showUnowned: false, selected: null }
async function set(id: string, mode: 'automatic' | 'following' | 'hidden') { const series = (await listSeries(owner)).find(item => (item.sourceSeriesIds ?? [item.id]).includes(id))!; return setSeriesVisibility(owner, id, { mode, version: series.visibilityVersion! }) }
describe('persistent series shelf preferences', () => {
  it('follows an empty series without creating owned copies', async () => {
    const series = await prisma.series.create({ data: { userId: owner, name: 'A future collection' } })
    expect(isSeriesVisible((await listSeries(owner))[0], prefs)).toBe(false)
    await set(series.id, 'following')
    expect(isSeriesVisible((await listSeries(owner))[0], prefs)).toBe(true)
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(0)
    await set(series.id, 'automatic')
    expect(isSeriesVisible((await listSeries(owner))[0], prefs)).toBe(false)
  })
  it('hides owned shelves and restores them while preserving all book and reading data', async () => {
    await applyCollectionImport(owner, collectionFixture())
    const before = await exportBackup(owner), series = (await listSeries(owner))[0]
    await set(series.id, 'hidden')
    const hidden = (await listSeries(owner))[0]
    expect(isSeriesVisible(hidden, { ...prefs, selected: series.id, showUnowned: true })).toBe(false)
    expect(isSeriesVisible(hidden, { ...prefs, showHidden: true })).toBe(true)
    const after = await exportBackup(owner)
    expect(after.books).toEqual(before.books); expect(after.works).toEqual(before.works); expect(after.contents).toEqual(before.contents)
    await set(series.id, 'following')
    await prisma.book.deleteMany({ where: { userId: owner } })
    expect(isSeriesVisible((await listSeries(owner))[0], prefs)).toBe(true)
  })
  it('updates every displayed alias together and blocks cross-account writes', async () => {
    const work = await prisma.work.create({ data: { userId: owner, title: 'No Life Forsaken', authorName: 'Steven Erikson' } })
    const one = await prisma.series.create({ data: { userId: owner, name: 'Tales of Witness', entries: { create: { workId: work.id } } } })
    const two = await prisma.series.create({ data: { userId: owner, name: 'Witness', entries: { create: { workId: work.id } } } })
    const group = (await listSeries(owner))[0]
    expect(group.sourceSeriesIds).toHaveLength(2)
    await expect(setSeriesVisibility(other, one.id, { mode: 'hidden', version: group.visibilityVersion! })).rejects.toMatchObject({ status: 404 })
    await set(two.id, 'following')
    expect((await listSeries(owner))[0].visibility).toBe('following')
    const backup = await exportBackup(owner), report = backup.imports.find(item => item.dataset === 'tome:series-management')!.report as { visibility: { seriesId: string }[] }
    expect(report.visibility.map(item => item.seriesId).sort()).toEqual([one.id, two.id].sort())
  })
  it('detects stale preferences even after automatic-following-automatic changes', async () => {
    const series = await prisma.series.create({ data: { userId: owner, name: 'ABA test' } })
    const original = (await listSeries(owner))[0]
    await set(series.id, 'following'); await set(series.id, 'automatic')
    await expect(setSeriesVisibility(owner, series.id, { mode: 'hidden', version: original.visibilityVersion! })).rejects.toMatchObject({ status: 409 })
    expect((await listSeries(owner))[0].visibility).toBe('automatic')
  })
  it('allows only one winner for concurrent hide and follow requests', async () => {
    const series = await prisma.series.create({ data: { userId: owner, name: 'Concurrent preferences' } }), snapshot = (await listSeries(owner))[0]
    const results = await Promise.allSettled((['hidden', 'following'] as const).map(mode => setSeriesVisibility(owner, series.id, { mode, version: snapshot.visibilityVersion! })))
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect((results.find(result => result.status === 'rejected') as PromiseRejectedResult).reason.status).toBe(409)
  })
  it('preserves shelf choices through reimport and backup ID remapping', async () => {
    const manifest = collectionFixture(); await applyCollectionImport(owner, manifest)
    const series = (await listSeries(owner))[0]; await set(series.id, 'hidden')
    await applyCollectionImport(owner, manifest)
    expect((await listSeries(owner))[0].visibility).toBe('hidden')
    await restoreBackup(other, await exportBackup(owner))
    const restored = (await listSeries(other))[0]
    expect(restored.visibility).toBe('hidden'); expect(restored.id).not.toBe(series.id)
  })
  it('requires an explicit retained preference when merging followed and hidden series', async () => {
    const target = await prisma.series.create({ data: { userId: owner, name: 'Target' } }), source = await prisma.series.create({ data: { userId: owner, name: 'Source' } })
    await set(target.id, 'following'); await set(source.id, 'hidden')
    const preview = await previewSeriesMerge(owner, { targetId: target.id, sourceId: source.id, name: target.name })
    const input = { mode: 'apply' as const, targetId: target.id, sourceId: source.id, name: target.name, version: preview.version, description: null, resolutions: [] }
    await expect(applySeriesMerge(owner, input)).rejects.toMatchObject({ status: 400 })
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(2)
    await applySeriesMerge(owner, { ...input, visibility: 'following' })
    expect((await listSeries(owner))[0].visibility).toBe('following')
  })
})
