// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { getReading, recordReading } from '@/lib/reading/service'
import { readingInput } from '@/lib/reading/validation'
import { readingProgress } from '@/lib/reading/progress'
if (process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Reading tests require an explicitly enabled disposable localhost database')
describe('reading log persistence and security', () => {
  let owner: string, other: string, author: string
  beforeAll(async () => {
    owner = (await prisma.user.create({ data: { email: `reading-${crypto.randomUUID()}@example.test`, passwordHash: 'test' } })).id
    other = (await prisma.user.create({ data: { email: `reading-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test' } })).id
    author = (await prisma.author.create({ data: { userId: owner, name: 'An Author' } })).id
  })
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } }); await prisma.$disconnect() })
  const book = (readingStatus: 'UNREAD' | 'READING' | 'READ') => prisma.book.create({ data: { userId: owner, authorId: author, title: `Test ${crypto.randomUUID()}`, source: 'IMPORT', readingStatus } })
  const write = (id: string, body: Record<string, unknown>, userId = owner) => recordReading(userId, id, readingInput.parse(body))
  it('does not manufacture dates or history for previously read books', async () => {
    const old = await book('READ')
    expect(await getReading(owner, old.id)).toEqual({ session: null })
    await expect(write(old.id, { action: 'start', page: 0 })).rejects.toThrow('Previously read books remain undated')
    expect(await prisma.readingSession.count({ where: { bookId: old.id } })).toBe(0)
  })
  it('records a new read, retries safely, corrects progress, finishes and can reopen it', async () => {
    const novel = await book('UNREAD')
    let { session } = await write(novel.id, { action: 'start', page: 0, totalPages: 100 })
    expect(session.startedAt).not.toBeNull()
    const requestId = crypto.randomUUID()
    const input = { action: 'log', sessionId: session.id, version: 0, requestId, page: 20, occurredAt: new Date().toISOString() }
    session = (await write(novel.id, input)).session
    expect((await write(novel.id, input)).session.logs).toHaveLength(1)
    await expect(write(novel.id, { ...input, requestId: crypto.randomUUID() })).rejects.toThrow('changed elsewhere')
    session = (await write(novel.id, { action: 'edit', sessionId: session.id, version: session.version, entryId: session.logs[0].id, page: 15, occurredAt: new Date().toISOString() })).session
    expect(readingProgress(JSON.parse(JSON.stringify(session))).pagesLogged).toBe(15)
    session = (await write(novel.id, { action: 'log', sessionId: session.id, version: session.version, requestId: crypto.randomUUID(), page: 100, occurredAt: new Date().toISOString(), finish: true })).session
    expect(session.finishedAt).not.toBeNull()
    expect((await prisma.book.findUniqueOrThrow({ where: { id: novel.id } })).readingStatus).toBe('READ')
    session = (await write(novel.id, { action: 'delete', sessionId: session.id, version: session.version, entryId: session.logs.find(log => log.isCompletion)!.id })).session
    expect(session.finishedAt).toBeNull()
    expect(readingProgress(JSON.parse(JSON.stringify(session))).pagesLogged).toBe(15)
    expect((await prisma.book.findUniqueOrThrow({ where: { id: novel.id } })).readingStatus).toBe('READING')
  })
  it('uses an existing reading page as a zero-credit baseline and validates dates/page bounds', async () => {
    const novel = await book('READING')
    let { session } = await write(novel.id, { action: 'start', page: 224, totalPages: 480 })
    expect(session.startedAt).toBeNull()
    expect(readingProgress(JSON.parse(JSON.stringify(session))).pagesLogged).toBe(0)
    const input = { action: 'log', sessionId: session.id, version: 0, requestId: crypto.randomUUID(), page: 230, occurredAt: new Date().toISOString() }
    await expect(write(novel.id, { ...input, page: 500 })).rejects.toThrow('exceeds')
    await expect(write(novel.id, { ...input, occurredAt: '2020-01-01T00:00:00Z' })).rejects.toThrow('after tracking began')
    await expect(write(novel.id, { ...input, occurredAt: new Date(Date.now() + 86400000).toISOString() })).rejects.toThrow('future')
    session = (await write(novel.id, input)).session
    expect(readingProgress(JSON.parse(JSON.stringify(session))).pagesLogged).toBe(6)
    await expect(write(novel.id, { action: 'settings', sessionId: session.id, version: session.version, baselinePage: 224, totalPages: 225 })).rejects.toThrow('below a recorded page')
  })
  it('rejects cross-user reads/writes and serializes simultaneous starts', async () => {
    const novel = await book('UNREAD')
    expect(await getReading(other, novel.id)).toBeNull()
    await expect(write(novel.id, { action: 'start', page: 0 }, other)).rejects.toThrow('Book not found')
    const outcomes = await Promise.allSettled([write(novel.id, { action: 'start', page: 0 }), write(novel.id, { action: 'start', page: 0 })])
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.readingSession.count({ where: { bookId: novel.id } })).toBe(1)
  })
})
