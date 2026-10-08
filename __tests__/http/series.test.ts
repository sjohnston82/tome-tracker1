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
    const series = await prisma.series.findFirstOrThrow({ where: { userId: owner } })
    const work = await prisma.work.findFirstOrThrow({ where: { userId: owner } })
    const book = await prisma.book.findFirstOrThrow({ where: { userId: owner } })
    expect((await call(`/api/series/${series.id}`, 'GET', undefined, otherCookie)).status).toBe(404)
    expect((await call(`/api/works/${work.id}`, 'PATCH', { title: 'Unauthorized change' }, otherCookie)).status).toBe(404)
    expect((await call(`/api/works/${work.id}/editions`, 'POST', { bookId: book.id }, otherCookie)).status).toBe(404)
    expect((await call(`/api/works/${work.id}/metadata`, 'GET', undefined, otherCookie)).status).toBe(404)
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
})
