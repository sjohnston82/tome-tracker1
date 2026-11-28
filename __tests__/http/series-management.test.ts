// @vitest-environment node
import { beforeEach, afterEach, afterAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { createToken } from '@/lib/auth/jwt'
const url = process.env.DATABASE_URL
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || new URL(url).hostname !== 'localhost') throw new Error('Series HTTP tests require an enabled disposable localhost database')
let owner: string, other: string, cookie: string, otherCookie: string
beforeEach(async () => {
  const user = await prisma.user.create({ data: { email: `merge-http-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } }); owner = user.id
  const second = await prisma.user.create({ data: { email: `merge-http-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } }); other = second.id
  cookie = `session=${await createToken({ userId: owner, email: user.email, role: 'USER' })}`; otherCookie = `session=${await createToken({ userId: other, email: second.email, role: 'USER' })}`
})
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other].filter(Boolean) } } }) })
afterAll(() => prisma.$disconnect())
const call = (path: string, body?: unknown, session = cookie) => fetch(`http://localhost:3000${path}`, { method: body ? 'POST' : 'GET', headers: { Cookie: session, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
async function fixture() {
  const author = await prisma.author.create({ data: { userId: owner, name: 'Merge Author' } })
  const one = await prisma.work.create({ data: { userId: owner, title: 'Shared title', authorName: author.name, publicationYear: 2000 } })
  const two = await prisma.work.create({ data: { userId: owner, title: one.title, authorName: author.name, publicationYear: 2001 } })
  const target = await prisma.series.create({ data: { userId: owner, name: 'Canonical series', entries: { create: { workId: one.id, position: 1, isConfirmed: true } } } })
  const source = await prisma.series.create({ data: { userId: owner, name: 'Duplicate series', entries: { create: { workId: two.id, position: 2 } } } })
  const book = await prisma.book.create({ data: { userId: owner, authorId: author.id, title: one.title, workId: two.id, readingStatus: 'READING', coverLocked: true, source: 'MANUAL' } })
  return { one, two, target, source, book, request: { mode: 'preview', targetId: target.id, sourceId: source.id, name: target.name } }
}
describe('signed series merge HTTP flow', () => {
  it('previews conflicts and atomically merges while preserving physical records and ownership', async () => {
    const f = await fixture()
    const options = await call('/api/series/merge'); expect(options.status).toBe(200); expect(options.headers.get('cache-control')).toBe('private, no-store')
    expect((await options.json()).series).toHaveLength(2)
    const response = await call('/api/series/merge', f.request); expect(response.status).toBe(200)
    const preview = (await response.json()).preview
    const apply = { ...f.request, mode: 'apply', version: preview.version, description: null, resolutions: [] as { groupId: string; mode: string; entryId: string; workId: string }[] }
    expect((await call('/api/series/merge', apply)).status).toBe(400)
    const group = preview.groups[0], choice = group.choices[0]
    apply.resolutions = [{ groupId: group.id, mode: 'combined', entryId: choice.entryId, workId: choice.workId }]
    expect((await call('/api/series/merge', apply)).status).toBe(200)
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(1)
    expect(await prisma.book.findUniqueOrThrow({ where: { id: f.book.id } })).toMatchObject({ title: f.book.title, workId: f.two.id, readingStatus: 'READING', coverLocked: true })
    const catalog = await (await call('/api/series')).json()
    expect(catalog.series[0].entries).toHaveLength(1)
    expect(catalog.series[0].entries[0].ownershipWorkIds).toHaveLength(2)
    expect((await call('/series/merge')).status).toBe(200)
  })
  it('rejects anonymous and cross-account access before merging', async () => {
    const f = await fixture()
    expect((await call('/api/series/merge', undefined, '')).status).toBe(401)
    expect((await call('/api/series/merge', f.request, '')).status).toBe(401)
    expect((await call('/api/series/merge', f.request, otherCookie)).status).toBe(404)
    expect((await (await call('/api/series/merge', undefined, otherCookie)).json()).series).toEqual([])
  })
  it('rejects a stale catalog preview without partially removing either series', async () => {
    const f = await fixture(), preview = (await (await call('/api/series/merge', f.request)).json()).preview
    await prisma.work.update({ where: { id: f.two.id }, data: { publicationYear: 2002 } })
    const group = preview.groups[0], choice = group.choices[0]
    const response = await call('/api/series/merge', { ...f.request, mode: 'apply', version: preview.version, description: null, resolutions: [{ groupId: group.id, mode: 'combined', entryId: choice.entryId, workId: choice.workId }] })
    expect(response.status).toBe(409)
    expect(await prisma.series.count({ where: { userId: owner } })).toBe(2)
    expect(await prisma.seriesEntry.count({ where: { series: { userId: owner } } })).toBe(2)
  })
  it('persists follow and hide preferences with authentication and version checks', async () => {
    const f = await fixture(), path = `/api/series/${f.target.id}/visibility`
    const catalog = (await (await call('/api/series')).json()).series
    const original = catalog.find((item: { id: string }) => item.id === f.target.id)
    const patch = (body: unknown, session = cookie) => fetch(`http://localhost:3000${path}`, { method: 'PATCH', headers: { Cookie: session, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    expect((await patch({ mode: 'following', version: original.visibilityVersion }, '')).status).toBe(401)
    expect((await patch({ mode: 'following', version: original.visibilityVersion }, otherCookie)).status).toBe(404)
    const follow = await patch({ mode: 'following', version: original.visibilityVersion })
    expect(follow.status).toBe(200); expect(follow.headers.get('cache-control')).toBe('private, no-store')
    let current = (await (await call('/api/series')).json()).series.find((item: { id: string }) => item.id === f.target.id)
    expect(current.visibility).toBe('following')
    expect((await patch({ mode: 'hidden', version: original.visibilityVersion })).status).toBe(409)
    expect((await patch({ mode: 'hidden', version: current.visibilityVersion })).status).toBe(200)
    current = (await (await call('/api/series')).json()).series.find((item: { id: string }) => item.id === f.target.id)
    expect(current.visibility).toBe('hidden')
    expect(await prisma.book.findUniqueOrThrow({ where: { id: f.book.id } })).toMatchObject({ title: f.book.title, readingStatus: 'READING', coverLocked: true })
    expect((await patch({ mode: 'automatic', version: current.visibilityVersion })).status).toBe(200)
  })

})
