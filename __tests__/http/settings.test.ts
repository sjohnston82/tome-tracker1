// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { createToken } from '@/lib/auth/jwt'
if (process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).hostname !== 'localhost') throw new Error('Settings HTTP tests require an explicitly enabled disposable localhost database')
describe('settings account HTTP actions', () => {
  let owner: string, other: string, cookie: string, bookId: string, sessionId: string
  const call = (path: string, method = 'GET', signed = true) => fetch(`http://localhost:3000${path}`, { method, headers: signed ? { Cookie: cookie } : {} })
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `settings-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })
    owner = user.id
    other = (await prisma.user.create({ data: { email: `settings-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id
    cookie = `session=${await createToken({ userId: owner, email: user.email, role: 'USER' })}`
    const author = await prisma.author.create({ data: { userId: owner, name: 'Test Author' } })
    const book = await prisma.book.create({ data: { userId: owner, authorId: author.id, title: 'Test Only', source: 'MANUAL' } })
    bookId = book.id
    const reading = await prisma.readingSession.create({ data: { bookId, logs: { create: { page: 20, requestId: crypto.randomUUID(), occurredAt: new Date() } } } })
    sessionId = reading.id
  })
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } }); await prisma.$disconnect() })
  it('returns a private account-labelled sync response and renders Settings', async () => {
    const response = await call('/api/library/sync')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect((await response.json()).userId).toBe(owner)
    expect((await call('/settings')).status).toBe(200)
  })
  it('sign-out clears the session cookie and anonymous deletion is rejected', async () => {
    const logout = await call('/api/auth/logout', 'POST')
    expect(logout.status).toBe(200)
    expect(logout.headers.get('set-cookie')).toMatch(/session=;/)
    expect((await call('/api/account', 'DELETE', false)).status).toBe(401)
    expect(await prisma.user.findUnique({ where: { id: owner } })).not.toBeNull()
  })
  it('deletes only the signed-in disposable account and its reading history', async () => {
    expect((await call('/api/account', 'DELETE')).status).toBe(200)
    expect(await prisma.user.findUnique({ where: { id: owner } })).toBeNull()
    expect(await prisma.book.findUnique({ where: { id: bookId } })).toBeNull()
    expect(await prisma.readingSession.findUnique({ where: { id: sessionId } })).toBeNull()
    expect(await prisma.readingLog.count({ where: { sessionId } })).toBe(0)
    expect(await prisma.user.findUnique({ where: { id: other } })).not.toBeNull()
  })
})
