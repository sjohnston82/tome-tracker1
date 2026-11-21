// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/db'
import { createToken } from '@/lib/auth/jwt'
import { collectionFixture } from '../fixtures/collection'

if (process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).hostname !== 'localhost') throw new Error('HTTP tests require an explicitly enabled disposable localhost database')

describe('series HTTP flow with actual signed sessions', () => {
  let owner: string
  let other: string
  let cookie: string
  let otherCookie: string
  const call = async (path: string, method = 'GET', body?: unknown, session = cookie) => fetch(`http://localhost:3000${path}`, { method, headers: { Cookie: session, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  beforeAll(async () => {
    const one = await prisma.user.create({ data: { email: `http-owner-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })
    const two = await prisma.user.create({ data: { email: `http-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })
    owner = one.id; other = two.id
    cookie = `session=${await createToken({ userId: owner, email: one.email, role: 'USER' })}`
    otherCookie = `session=${await createToken({ userId: other, email: two.email, role: 'USER' })}`
  })
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } }); await prisma.$disconnect() })

  it('previews and applies collection import then exposes omnibus ownership in a checklist', async () => {
    const manifest = collectionFixture()
    expect((await call('/api/collection-import', 'POST', { mode: 'preview', manifest })).status).toBe(200)
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(0)
    const result = await call('/api/collection-import', 'POST', { mode: 'apply', manifest })
    expect(result.status).toBe(200)
    expect(await result.json()).toMatchObject({ actualOwned: 1, reconciled: true })
    const response = await call('/api/series')
    expect(response.status).toBe(200)
    const catalog = await response.json()
    expect(catalog.series[0].entries[0].work.containedIn[0].book.readingStatus).toBe('READ')
    expect(catalog.series[0].entries[1].work.editions).toEqual([])
    expect((await call('/series')).status).toBe(200)
  })

  it('rejects anonymous access and another user’s edits, reads and edition links', async () => {
    expect((await call('/api/series', 'GET', undefined, '')).status).toBe(401)
    expect((await call('/api/works/any-work/cover', 'GET', undefined, '')).status).toBe(401)
    const series = await prisma.series.findFirstOrThrow({ where: { userId: owner } })
    const work = await prisma.work.findFirstOrThrow({ where: { userId: owner } })
    const book = await prisma.book.findFirstOrThrow({ where: { userId: owner } })
    expect((await call(`/api/series/${series.id}`, 'GET', undefined, otherCookie)).status).toBe(404)
    expect((await call(`/api/works/${work.id}`, 'PATCH', { title: 'Unauthorized change' }, otherCookie)).status).toBe(404)
    expect((await call(`/api/works/${work.id}/editions`, 'POST', { bookId: book.id }, otherCookie)).status).toBe(404)
    expect((await call(`/api/works/${work.id}/metadata`, 'GET', undefined, otherCookie)).status).toBe(404)
    expect((await call(`/api/works/${work.id}/cover`, 'GET', undefined, otherCookie)).status).toBe(404)
    expect((await prisma.work.findUniqueOrThrow({ where: { id: work.id } })).title).not.toBe('Unauthorized change')
  })

  it('updates physical reading status and includes it in library sync', async () => {
    const book = await prisma.book.findFirstOrThrow({ where: { userId: owner } })
    const response = await call(`/api/books/${book.id}`, 'PATCH', { readingStatus: 'READING' })
    expect(response.status).toBe(200)
    expect((await response.json()).book.readingStatus).toBe('READING')
    const snapshot = await (await call('/api/library/sync')).json()
    expect(snapshot.authors[0].books[0].readingStatus).toBe('READING')
  })

  it('preserves manually selected or removed covers and prevents cross-user changes', async () => {
    const book = await prisma.book.findFirstOrThrow({ where: { userId: owner } })
    const path = `/api/books/${book.id}/covers`
    const coverUrl = 'https://covers.openlibrary.org/b/id/42-L.jpg?default=false'
    expect((await call(path, 'PATCH', { coverUrl }, otherCookie)).status).toBe(404)
    expect((await call(path, 'PATCH', { coverUrl })).status).toBe(200)
    expect(await prisma.book.findUnique({ where: { id: book.id } })).toMatchObject({ coverUrl, coverLocked: true })
    const shelves = await (await call('/api/series')).json()
    expect(shelves.series[0].entries[0].work.containedIn[0].book).toMatchObject({ coverUrl, coverLocked: true })
    const otherShelves = await (await call('/api/series', 'GET', undefined, otherCookie)).json()
    expect(otherShelves.series).toEqual([])
    expect((await call(path, 'PATCH', { coverUrl: null })).status).toBe(200)
    const result = await (await call('/api/enrichment/covers', 'POST', {})).json()
    expect(result.processed).toBe(0)
    expect(await prisma.book.findUnique({ where: { id: book.id } })).toMatchObject({ coverUrl: null, coverLocked: true })
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1)
  })

  it('tracks a new read through signed HTTP sessions without exposing it to another user', async () => {
    const book = await prisma.book.findFirstOrThrow({ where: { userId: owner } })
    await call(`/api/books/${book.id}`, 'PATCH', { readingStatus: 'UNREAD' })
    const path = `/api/books/${book.id}/reading`
    expect((await call(path, 'GET', undefined, otherCookie)).status).toBe(404)
    expect((await call(path, 'POST', { action: 'start' }, '')).status).toBe(401)
    const started = await call(path, 'POST', { action: 'start', page: 0, totalPages: 100 })
    expect(started.status).toBe(200)
    let { session } = await started.json()
    expect(session.startedAt).not.toBeNull()
    const logged = await call(path, 'POST', { action: 'log', sessionId: session.id, version: session.version, requestId: crypto.randomUUID(), page: 20, occurredAt: new Date().toISOString(), note: 'Chapter two' })
    expect(logged.status).toBe(200)
    session = (await logged.json()).session
    expect(session.logs[0]).toMatchObject({ page: 20, note: 'Chapter two' })
    expect((await call(path, 'POST', { action: 'log', sessionId: session.id, version: session.version, requestId: crypto.randomUUID(), page: 100, occurredAt: new Date().toISOString(), finish: true })).status).toBe(200)
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).readingStatus).toBe('READ')
    expect((await (await call(path)).json()).session.finishedAt).not.toBeNull()
  })
  it('reconciles aliases and unlinked editions without database mutations and retains real edit targets', async () => {
    const author = await prisma.author.create({ data: { userId: owner, name: 'Robert Jordan' } })
    const owned = await prisma.book.create({ data: { userId: owner, authorId: author.id, title: 'The New Spring', readingStatus: 'READING', source: 'MANUAL', coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg', coverLocked: true } })
    const work = await prisma.work.create({ data: { userId: owner, title: 'New Spring', authorName: 'Robert Jordan' } })
    await prisma.series.create({ data: { userId: owner, name: 'The Wheel of Time', entries: { create: { workId: work.id, position: 0 } } } })
    const firstWork = await prisma.work.create({ data: { userId: owner, title: 'No Life Forsaken', authorName: 'Steven Erikson' } })
    const secondWork = await prisma.work.create({ data: { userId: owner, title: 'The God Is Not Willing', authorName: 'Steven Erikson' } })
    await prisma.series.create({ data: { userId: owner, name: 'Tales of Witness', entries: { create: { workId: secondWork.id, position: 1 } } } })
    const alias = await prisma.series.create({ data: { userId: owner, name: 'Witness', entries: { create: { workId: firstWork.id, position: 2 } } } })
    const before = await prisma.book.count({ where: { userId: owner } })
    const catalog = await (await call('/api/series')).json()
    const wheel = catalog.series.find((item: { name: string }) => item.name === 'The Wheel of Time')
    expect(wheel.entries[0].work.editions[0]).toMatchObject({ id: owned.id, title: 'The New Spring', readingStatus: 'READING', coverLocked: true })
    expect(await prisma.book.findUnique({ where: { id: owned.id } })).toMatchObject({ workId: null, title: 'The New Spring' })
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(before)
    const tales = catalog.series.filter((item: { name: string }) => /Witness/.test(item.name))
    expect(tales).toHaveLength(1)
    const entry = tales[0].entries.find((item: { work: { id: string } }) => item.work.id === firstWork.id)
    expect(entry.seriesId).toBe(alias.id)
    expect((await call(`/api/series/${entry.seriesId}/entries/${entry.id}`, 'PATCH', { position: 2.5, isConfirmed: true })).status).toBe(200)
    expect((await prisma.seriesEntry.findUniqueOrThrow({ where: { id: entry.id } })).position?.toString()).toBe('2.5')
    // A removed physical copy immediately ceases to be inferred as owned.
    await prisma.book.delete({ where: { id: owned.id } })
    const refreshed = await (await call('/api/series')).json()
    expect(refreshed.series.find((item: { name: string }) => item.name === 'The Wheel of Time').entries[0].work.editions).toEqual([])
  })

})
