// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { findScanMatches, linkScannedIsbn } from '@/lib/books/scan-service';
const url = process.env.DATABASE_URL;
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Scan linking tests require an explicitly enabled disposable localhost database');
let owner: string, other: string;
beforeEach(async () => {
  owner = (await prisma.user.create({ data: { email: `scan-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id;
  other = (await prisma.user.create({ data: { email: `scan-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id;
});
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } }); });
afterAll(async () => { await prisma.$disconnect(); });
async function copy(userId = owner, isbn13: string | null = null, isbn10: string | null = null) {
  const author = await prisma.author.upsert({ where: { userId_name: { userId, name: 'George R. R. Martin' } }, update: {}, create: { userId, name: 'George R. R. Martin' } });
  return prisma.book.create({ data: { userId, authorId: author.id, title: 'A Clash of Kings', source: 'IMPORT', isbn13, isbn10, readingStatus: 'READING', coverLocked: true, coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg', publisher: 'Manually corrected publisher', publicationYear: 1998, tags: ['personal'], genres: ['Fantasy'], importKey: crypto.randomUUID() } });
}
describe('scan linking against disposable PostgreSQL', () => {
  it('links in place and preserves all book metadata, series/work relationships, import identity and reading history', async () => {
    const book = await copy();
    const work = await prisma.work.create({ data: { userId: owner, title: 'A Clash of Kings', authorName: 'George R. R. Martin' } });
    await prisma.book.update({ where: { id: book.id }, data: { workId: work.id } });
    await prisma.bookContent.create({ data: { bookId: book.id, workId: work.id } });
    const series = await prisma.series.create({ data: { userId: owner, name: 'A Song of Ice and Fire', entries: { create: { workId: work.id, position: 2 } } } });
    await prisma.readingSession.create({ data: { bookId: book.id, baselinePage: 100, totalPages: 600, logs: { create: { page: 125, requestId: crypto.randomUUID(), occurredAt: new Date(), note: 'Keep this log' } } } });
    const include = { readingSessions: { include: { logs: true } }, contents: true, author: true, work: true };
    const before = await prisma.book.findUniqueOrThrow({ where: { id: book.id }, include });
    const review = await findScanMatches(owner, { isbn: '9780553579901', title: 'A Clash of Kings', authors: ['George R.R. Martin'] });
    expect(review.matches[0]).toMatchObject({ id: book.id, kind: 'title-author', canLink: true });
    expect(await linkScannedIsbn(owner, book.id, '0-553-57990-8', review.matches[0].updatedAt)).toMatchObject({ bookId: book.id, isbn13: '9780553579901', alreadyLinked: false });
    const after = await prisma.book.findUniqueOrThrow({ where: { id: book.id }, include });
    expect(after).toEqual({ ...before, isbn13: '9780553579901', updatedAt: after.updatedAt });
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1);
    expect(await prisma.seriesEntry.count({ where: { seriesId: series.id, workId: work.id } })).toBe(1);
    expect(await linkScannedIsbn(owner, book.id, '9780553579901', before.updatedAt.toISOString())).toMatchObject({ alreadyLinked: true });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).updatedAt).toEqual(after.updatedAt);
  });
  it('does not disclose other accounts or replace an existing edition or conflicting ISBN-10', async () => {
    const foreign = await copy(other), own = await copy(owner, '9780306406157'), legacy = await copy(owner, null, '0306406152');
    expect(await linkScannedIsbn(owner, foreign.id, '9780553579901', foreign.updatedAt.toISOString())).toMatchObject({ error: 'NOT_FOUND' });
    expect(await linkScannedIsbn(owner, own.id, '9780553579901', own.updatedAt.toISOString())).toMatchObject({ error: 'DIFFERENT_ISBN' });
    expect(await linkScannedIsbn(owner, legacy.id, '9780553579901', legacy.updatedAt.toISOString())).toMatchObject({ error: 'DIFFERENT_ISBN' });
    const matches = await findScanMatches(owner, { title: 'A Clash of Kings', authors: ['George R. R. Martin'] });
    expect(matches.matches.some(book => book.id === foreign.id)).toBe(false);
  });
  it('rejects a stale review and an ISBN already recorded on another legacy copy', async () => {
    const book = await copy(), legacy = await copy(owner, null, '0-553-57990-8');
    expect(await linkScannedIsbn(owner, book.id, '9780553579901', book.updatedAt.toISOString())).toMatchObject({ error: 'ISBN_IN_USE', existingBookId: legacy.id });
    await prisma.book.update({ where: { id: book.id }, data: { readingStatus: 'READ', updatedAt: new Date(book.updatedAt.getTime() + 1000) } });
    expect(await linkScannedIsbn(owner, book.id, '9780451187840', book.updatedAt.toISOString())).toMatchObject({ error: 'STALE_BOOK' });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: book.id } })).isbn13).toBeNull();
  });
  it('allows only one winning link when two copies concurrently claim the same ISBN', async () => {
    const left = await copy(), right = await copy();
    const results = await Promise.all([linkScannedIsbn(owner, left.id, '9780451187840', left.updatedAt.toISOString()), linkScannedIsbn(owner, right.id, '9780451187840', right.updatedAt.toISOString())]);
    expect(results.filter(result => !('error' in result))).toHaveLength(1);
    expect(results.filter(result => 'error' in result && result.error === 'ISBN_IN_USE')).toHaveLength(1);
    expect(await prisma.book.count({ where: { userId: owner, isbn13: '9780451187840' } })).toBe(1);
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(2);
  });
});
