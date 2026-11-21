// @vitest-environment node
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { applyCollectionImport, stageCollectionPreview } from '@/lib/import/collection-service';
import { getMetadataReview, resolveMetadataReview } from '@/lib/review/service';
import { exportBackup, restoreBackup } from '@/lib/backup/service';
import { collectionFixture, bookKey, workKey, missingKey } from '../fixtures/collection';
if (process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Metadata review tests require an explicitly enabled disposable localhost database');
let owner: string, other: string;
beforeEach(async () => {
  owner = (await prisma.user.create({ data: { email: `review-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id;
  other = (await prisma.user.create({ data: { email: `review-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id;
});
afterEach(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } }); });
afterAll(async () => { await prisma.$disconnect(); });
async function imported() {
  const manifest = collectionFixture(); manifest.books[0].publicationYear = 1952;
  await applyCollectionImport(owner, manifest);
  const book = await prisma.book.findUniqueOrThrow({ where: { userId_importKey: { userId: owner, importKey: bookKey } } });
  await prisma.book.update({ where: { id: book.id }, data: { publicationYear: 2005, readingStatus: 'UNREAD', coverLocked: true, coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' } });
  return { manifest, bookId: book.id };
}
const resolve = (item: { id: string; version: string }, action: 'keep' | 'reopen' | 'source' | 'year' | 'confirm' | 'pin', extra = {}, userId = owner) => resolveMetadataReview(userId, { id: item.id, version: item.version, action, ...extra });
describe('metadata review against disposable PostgreSQL', () => {
  it('persists keep/reopen decisions across import reruns and backup restore without overwriting corrections', async () => {
    const { manifest, bookId } = await imported();
    let item = (await getMetadataReview(owner)).items.find(item => item.code === 'PUBLICATION_CONFLICT' && item.href.includes(bookId))!;
    expect(await resolve(item, 'keep')).toEqual({ success: true });
    await applyCollectionImport(owner, manifest);
    item = (await getMetadataReview(owner)).items.find(row => row.id === item.id)!; expect(item.resolved).toBe(true);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).publicationYear).toBe(2005);
    await restoreBackup(other, await exportBackup(owner));
    expect((await getMetadataReview(other)).items.find(row => row.id === item.id)?.resolved).toBe(true);
    expect(await resolve(item, 'reopen')).toEqual({ success: true }); await stageCollectionPreview(owner, manifest);
    expect((await getMetadataReview(owner)).items.find(row => row.id === item.id)?.resolved).toBe(false);
    await applyCollectionImport(owner, manifest);
    expect((await getMetadataReview(owner)).items.find(row => row.id === item.id)?.resolved).toBe(false);
  });
  it('changes only a confirmed field and preserves reading logs, cover locks, import identity and physical count', async () => {
    const { bookId } = await imported();
    await prisma.book.update({ where: { id: bookId }, data: { readingStatus: 'READING' } });
    await prisma.readingSession.create({ data: { bookId, baselinePage: 100, totalPages: 600, logs: { create: { page: 125, requestId: crypto.randomUUID(), occurredAt: new Date() } } } });
    const before = await prisma.book.findUniqueOrThrow({ where: { id: bookId }, include: { readingSessions: { include: { logs: true } }, contents: true } });
    const queue = await getMetadataReview(owner);
    const reading = queue.items.find(item => item.code === 'READING_CONFLICT')!;
    expect(reading.actions).not.toContain('source'); expect(await resolve(reading, 'source')).toMatchObject({ error: 'ACTION_NOT_AVAILABLE' });
    const year = queue.items.find(item => item.code === 'PUBLICATION_CONFLICT' && item.href.includes(bookId))!;
    expect(await resolve(year, 'source')).toEqual({ success: true });
    const after = await prisma.book.findUniqueOrThrow({ where: { id: bookId }, include: { readingSessions: { include: { logs: true } }, contents: true } });
    expect(after).toEqual({ ...before, publicationYear: 1952, updatedAt: after.updatedAt }); expect(await prisma.book.count({ where: { userId: owner } })).toBe(1);
  });
  it('rejects stale decisions and another account’s missing-data item', async () => {
    const { bookId } = await imported();
    const item = (await getMetadataReview(owner)).items.find(item => item.code === 'PUBLICATION_CONFLICT' && item.href.includes(bookId))!;
    await prisma.book.update({ where: { id: bookId }, data: { publicationYear: 2006 } });
    expect(await resolve(item, 'source')).toMatchObject({ error: 'STALE_REVIEW' }); expect(await resolve(item, 'keep', {}, other)).toMatchObject({ error: 'NOT_FOUND' });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).publicationYear).toBe(2006);
  });
  it('stages ambiguous editions without importing records and pins only an explicitly selected owned candidate', async () => {
    const manifest = collectionFixture();
    const author = await prisma.author.create({ data: { userId: owner, name: 'An Author' } });
    const data = { userId: owner, authorId: author.id, title: 'An Omnibus', source: 'MANUAL' as const, readingStatus: 'READ' as const };
    const left = await prisma.book.create({ data }), right = await prisma.book.create({ data });
    const staged = await stageCollectionPreview(owner, manifest); expect(staged.ready).toBe(false); expect(await prisma.work.count({ where: { userId: owner } })).toBe(0); expect(await prisma.book.count({ where: { userId: owner } })).toBe(2);
    const item = (await getMetadataReview(owner)).items.find(item => item.code === 'AMBIGUOUS_EDITION')!;
    expect(await resolve(item, 'pin', { candidateId: crypto.randomUUID() })).toMatchObject({ error: 'ACTION_NOT_AVAILABLE' });
    expect(await resolve(item, 'pin', { candidateId: left.id })).toEqual({ success: true });
    expect((await prisma.book.findUniqueOrThrow({ where: { id: right.id } })).importKey).toBeNull();
    expect((await applyCollectionImport(owner, manifest)).applied).toBe(true); expect(await prisma.book.count({ where: { userId: owner } })).toBe(2);
    expect((await getMetadataReview(owner)).pendingImport).toBe(false);
  });
  it('updates an unowned work’s verified year and confirms series order without creating a physical copy', async () => {
    await applyCollectionImport(owner, collectionFixture());
    const work = await prisma.work.findUniqueOrThrow({ where: { userId_importKey: { userId: owner, importKey: missingKey } } });
    await prisma.work.update({ where: { id: work.id }, data: { publicationYear: null } });
    const queue = await getMetadataReview(owner), missing = queue.items.find(item => item.code === 'MISSING_WORK_YEAR' && item.title === 'Second Novel')!;
    expect(await resolve(missing, 'year', { value: 2027 })).toEqual({ success: true });
    const order = (await getMetadataReview(owner)).items.find(item => item.code === 'UNCONFIRMED_ORDER')!;
    expect(await resolve(order, 'confirm')).toEqual({ success: true });
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1); expect((await prisma.work.findUniqueOrThrow({ where: { id: work.id } })).publicationYear).toBe(2027);
    const originalWork = await prisma.work.findUniqueOrThrow({ where: { userId_importKey: { userId: owner, importKey: workKey } } }); expect(originalWork.publicationYear).toBe(1990);
  });
});
