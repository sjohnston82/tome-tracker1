// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { exportBackup, restoreBackup, NonemptyLibraryError } from '@/lib/backup/service';
const url = process.env.DATABASE_URL;
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Backup tests require an enabled disposable localhost database');
describe('full library backup round trip', () => {
  let source: string, target: string;
  beforeAll(async () => {
    source = (await prisma.user.create({ data: { email: `backup-${crypto.randomUUID()}@example.test`, passwordHash: 'not-exported' } })).id;
    target = (await prisma.user.create({ data: { email: `restore-${crypto.randomUUID()}@example.test`, passwordHash: 'not-exported' } })).id;
    const author = await prisma.author.create({ data: { userId: source, name: 'Corrected Author', bio: 'Manual biography' } });
    const owned = await prisma.work.create({ data: { userId: source, title: 'Owned work', authorName: author.name, publicationYear: 1952, importKey: 'work-1' } });
    const missing = await prisma.work.create({ data: { userId: source, title: 'Missing novella', authorName: author.name } });
    const series = await prisma.series.create({ data: { userId: source, name: 'My Series', entries: { create: [{ workId: owned.id, position: '1.000', isConfirmed: true }, { workId: missing.id, position: '1.500', entryType: 'NOVELLA' }] } } });
    await prisma.series.create({ data: { userId: source, name: 'Overlapping Series', entries: { create: { workId: owned.id, position: '0.500' } } } });
    const book = await prisma.book.create({ data: { userId: source, authorId: author.id, workId: owned.id, title: 'Corrected physical omnibus', publicationYear: 2005, coverLocked: true, coverUrl: 'https://covers.openlibrary.org/b/id/123-L.jpg', readingStatus: 'READING', source: 'IMPORT', importKey: 'book-1', contents: { create: [{ workId: owned.id }, { workId: missing.id }] } } });
    await prisma.readingSession.create({ data: { bookId: book.id, baselinePage: 224, totalPages: 608, logs: { create: { requestId: 'preserved-request', page: 250, occurredAt: new Date('2026-11-19T15:48:00Z'), note: 'Private reading note' } } } });
    await prisma.collectionImport.create({ data: { userId: source, dataset: 'source', manifest: { source: 'Excel' }, report: { review: ['Conflict remains for review'] } } });
    expect(series.id).toBeTruthy();
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [source, target].filter(Boolean) } } }); await prisma.$disconnect(); });
  it('restores manual metadata, series, omnibus contents and reading logs with fresh IDs', async () => {
    const backup = await exportBackup(source);
    expect(JSON.stringify(backup)).not.toContain('not-exported'); expect(JSON.stringify(backup)).not.toContain(source);
    await restoreBackup(target, backup);
    const restored = await exportBackup(target);
    expect(restored.books).toHaveLength(1); expect(restored.works).toHaveLength(2); expect(restored.entries).toHaveLength(3); expect(restored.contents).toHaveLength(2);
    expect(restored.books[0]).toMatchObject({ title: 'Corrected physical omnibus', publicationYear: 2005, coverLocked: true, readingStatus: 'READING', importKey: 'book-1' });
    expect(restored.books[0].id).not.toBe(backup.books[0].id);
    expect(restored.sessions[0]).toMatchObject({ baselinePage: 224, totalPages: 608 });
    expect(restored.logs[0]).toMatchObject({ requestId: 'preserved-request', page: 250, note: 'Private reading note', sessionId: restored.sessions[0].id });
    expect(restored.entries.map(e => e.position).sort()).toEqual(backup.entries.map(e => e.position).sort());
    expect(restored.imports[0].report).toEqual(backup.imports[0].report);
  });
  it('refuses repeated restores and invalid references without modifying either account', async () => {
    const backup = await exportBackup(source);
    await expect(restoreBackup(target, backup)).rejects.toBeInstanceOf(NonemptyLibraryError);
    await expect(restoreBackup(target, { ...backup, authors: [] })).rejects.toThrow();
    expect(await prisma.book.count({ where: { userId: source } })).toBe(1); expect(await prisma.book.count({ where: { userId: target } })).toBe(1);
  });
});
