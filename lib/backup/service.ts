import { OWNERSHIP_DATASET, remapOwnershipReport } from '@/lib/series/ownership-decisions';
import { retryTransaction } from '@/lib/transaction-retry';
import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { backupSchema, type Backup } from './validation';
import { randomUUID } from 'node:crypto';

export async function exportBackup(userId: string): Promise<Backup> {
  return prisma.$transaction(async tx => {
    const [authors, works, books, series, entries, contents, sessions, logs, imports] = await Promise.all([
      tx.author.findMany({ where: { userId } }), tx.work.findMany({ where: { userId } }), tx.book.findMany({ where: { userId } }), tx.series.findMany({ where: { userId } }),
      tx.seriesEntry.findMany({ where: { series: { userId } } }), tx.bookContent.findMany({ where: { book: { userId } } }), tx.readingSession.findMany({ where: { book: { userId } } }), tx.readingLog.findMany({ where: { session: { book: { userId } } } }), tx.collectionImport.findMany({ where: { userId } }),
    ]);
    // Parsing deliberately excludes account IDs, credentials and any unknown fields.
    return backupSchema.parse(JSON.parse(JSON.stringify({ format: 'tome-tracker-backup', version: 1, exportedAt: new Date().toISOString(), authors, works, books, series, entries, contents, sessions, logs, imports })));
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}
export class NonemptyLibraryError extends Error {}
export async function restoreBackup(userId: string, input: unknown) {
  const backup = backupSchema.parse(input);
  await retryTransaction(() => prisma.$transaction(async tx => {
    const counts = await Promise.all([tx.book.count({ where: { userId } }), tx.author.count({ where: { userId } }), tx.work.count({ where: { userId } }), tx.series.count({ where: { userId } }), tx.collectionImport.count({ where: { userId } })]);
    if (counts.some(Boolean)) throw new NonemptyLibraryError('Restore requires an empty library. Existing data will not be overwritten.');
    const mapping = () => new Map<string, string>();
    const authors = mapping(), works = mapping(), books = mapping(), series = mapping(), sessions = mapping();
    for (const [items, map] of [[backup.authors, authors], [backup.works, works], [backup.books, books], [backup.series, series], [backup.sessions, sessions]] as const) for (const item of items) map.set(item.id, randomUUID());
    await tx.author.createMany({ data: backup.authors.map(a => ({ ...a, id: authors.get(a.id)!, userId })) });
    await tx.work.createMany({ data: backup.works.map(w => ({ ...w, id: works.get(w.id)!, userId })) });
    await tx.series.createMany({ data: backup.series.map(s => ({ ...s, id: series.get(s.id)!, userId })) });
    await tx.book.createMany({ data: backup.books.map(b => ({ ...b, id: books.get(b.id)!, userId, authorId: authors.get(b.authorId)!, workId: b.workId ? works.get(b.workId)! : null })) });
    await tx.seriesEntry.createMany({ data: backup.entries.map(e => ({ ...e, id: randomUUID(), seriesId: series.get(e.seriesId)!, workId: works.get(e.workId)! })) });
    await tx.bookContent.createMany({ data: backup.contents.map(c => ({ bookId: books.get(c.bookId)!, workId: works.get(c.workId)! })) });
    await tx.readingSession.createMany({ data: backup.sessions.map(s => ({ ...s, id: sessions.get(s.id)!, bookId: books.get(s.bookId)! })) });
    await tx.readingLog.createMany({ data: backup.logs.map(l => ({ ...l, id: randomUUID(), sessionId: sessions.get(l.sessionId)! })) });
    await tx.collectionImport.createMany({ data: backup.imports.map(i => ({ ...i, id: randomUUID(), userId, manifest: i.manifest === null ? Prisma.JsonNull : i.manifest, report: i.dataset === OWNERSHIP_DATASET ? remapOwnershipReport(i.report, works, books) : i.report === null ? Prisma.JsonNull : i.report })) });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 }));
  return { books: backup.books.length, logs: backup.logs.length };
}
const csvCell = (input: unknown) => { let value = String(input ?? ''); if (/^[\s]*[=+@-]/.test(value) || /^[\t\r\n]/.test(value)) value = "'" + value; return '"' + value.replaceAll('"', '""') + '"'; };
export function libraryCSV(backup: Backup) {
  const authors = new Map(backup.authors.map(a => [a.id, a.name]));
  return '\ufeff' + [['Title', 'Author', 'ISBN13', 'ISBN10', 'Publication year', 'Reading status', 'Series', 'Series number', 'Publisher', 'Cover URL', 'Tags', 'Genres'], ...backup.books.map(b => [b.title, authors.get(b.authorId), b.isbn13, b.isbn10, b.publicationYear, b.readingStatus, b.seriesName, b.seriesNumber, b.publisher, b.coverUrl, b.tags.join('; '), b.genres.join('; ')])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
