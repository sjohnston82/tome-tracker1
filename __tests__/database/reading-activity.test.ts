// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { getReadingActivity } from '@/lib/reading/activity-service';
import { recordReading } from '@/lib/reading/service';
const url = process.env.DATABASE_URL;
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Activity tests require an enabled disposable localhost database');
describe('reading activity persistence and account isolation', () => {
  let owner: string, other: string, bookId: string, sessionId: string, entryId: string;
  beforeAll(async () => {
    owner = (await prisma.user.create({ data: { email: `activity-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id;
    other = (await prisma.user.create({ data: { email: `activity-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id;
    const author = await prisma.author.create({ data: { userId: owner, name: 'Owner Author' } });
    await prisma.book.create({ data: { userId: owner, authorId: author.id, title: 'Historical Read Without Date', source: 'IMPORT', readingStatus: 'READ' } });
    const book = await prisma.book.create({ data: { userId: owner, authorId: author.id, title: 'Dated Novel', source: 'MANUAL', readingStatus: 'READ' } }); bookId = book.id;
    const session = await prisma.readingSession.create({ data: { bookId, baselinePage: 224, totalPages: 608, trackedAt: new Date('2025-12-01T12:00:00Z'), finishedAt: new Date('2026-04-10T12:00:00Z'), logs: { create: [
      { requestId: 'previous-year', page: 230, occurredAt: new Date('2025-12-31T12:00:00Z') },
      { requestId: 'jan', page: 240, occurredAt: new Date('2026-01-10T12:00:00Z') },
      { requestId: 'finish', page: 300, occurredAt: new Date('2026-04-10T12:00:00Z'), isCompletion: true },
    ] } }, include: { logs: true } }); sessionId = session.id; entryId = session.logs.find(l => l.requestId === 'finish')!.id;
    const otherAuthor = await prisma.author.create({ data: { userId: other, name: 'Private Other Author' } });
    const privateBook = await prisma.book.create({ data: { userId: other, authorId: otherAuthor.id, title: 'Private Other Book', source: 'MANUAL', readingStatus: 'READ' } });
    await prisma.readingSession.create({ data: { bookId: privateBook.id, finishedAt: new Date('2026-02-01T12:00:00Z'), logs: { create: { requestId: 'secret', page: 999, occurredAt: new Date('2026-02-01T12:00:00Z'), note: 'Secret Other Note' } } } });
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other].filter(Boolean) } } }); await prisma.$disconnect(); });
  it('keeps legacy Read records separate and includes only this account’s sessions', async () => {
    const result = await getReadingActivity(owner, 2026, 'UTC');
    expect(result.totals).toMatchObject({ pages: 70, books: 1, completedReads: 1, activeDays: 2 }); expect(result.undatedReadBooks).toBe(1);
    expect(result.months[0].pages).toBe(10); expect(result.months[3].pages).toBe(60);
    expect(JSON.stringify(result)).not.toContain('Private Other'); expect(JSON.stringify(result)).not.toContain('Secret Other Note');
    expect(result.quarters[1].finished[0]).toMatchObject({ bookId, title: 'Dated Novel', day: '2026-04-10' });
    expect((await getReadingActivity(other, 2026, 'UTC')).totals.pages).toBe(999);
  });
  it('recomputes dates, pages and completions after actual edit and removal operations', async () => {
    let { session } = await recordReading(owner, bookId, { action: 'edit', sessionId, version: 0, entryId, page: 280, occurredAt: '2026-05-10T12:00:00Z', note: 'Corrected date and page' });
    let result = await getReadingActivity(owner, 2026, 'UTC'); expect(result.months[3].pages).toBe(0); expect(result.months[4].pages).toBe(40); expect(result.totals.pages).toBe(50);
    await recordReading(owner, bookId, { action: 'delete', sessionId, version: session.version, entryId });
    result = await getReadingActivity(owner, 2026, 'UTC'); expect(result.totals).toMatchObject({ pages: 10, books: 0 }); expect(result.quarters[1].finished).toEqual([]); expect(result.undatedReadBooks).toBe(1);
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(2);
  });
});
