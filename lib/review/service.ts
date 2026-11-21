import { Prisma, type ReadingStatus, type SeriesEntryType } from '@prisma/client';
import { prisma } from '@/lib/db';
import { retryTransaction } from '@/lib/transaction-retry';
import { buildReviewQueue, publicReviewQueue, type ReviewSnapshot } from './queue';
import { jsonObject, PREVIEW_DATASET, readReviewDecisions } from './decisions';
import type { ReviewAction } from './types';
type Client = Prisma.TransactionClient;
export async function loadReviewSnapshot(tx: Client, userId: string): Promise<ReviewSnapshot> {
  const [books, works, entries, imports] = await Promise.all([
    tx.book.findMany({ where: { userId }, select: { id: true, title: true, author: { select: { name: true } }, publicationYear: true, readingStatus: true, coverUrl: true, coverLocked: true, isbn13: true, isbn10: true, importKey: true, updatedAt: true, workId: true, contents: { where: { work: { userId } }, select: { workId: true } }, readingSessions: { where: { finishedAt: null }, select: { id: true } } } }),
    tx.work.findMany({ where: { userId }, select: { id: true, title: true, authorName: true, publicationYear: true, importKey: true, updatedAt: true } }),
    tx.seriesEntry.findMany({ where: { series: { userId }, work: { userId } }, select: { id: true, workId: true, position: true, entryType: true, isConfirmed: true, series: { select: { id: true, name: true } } } }),
    tx.collectionImport.findMany({ where: { userId, dataset: { in: ['tome-collection', PREVIEW_DATASET] } }, select: { id: true, dataset: true, manifest: true, report: true, updatedAt: true } }),
  ]);
  return { books: books.map(book => ({ ...book, updatedAt: book.updatedAt.toISOString() })), works: works.map(work => ({ ...work, updatedAt: work.updatedAt.toISOString() })), entries: entries.map(entry => ({ ...entry, position: entry.position?.toString() ?? null })), imports: imports.map(row => ({ ...row, updatedAt: row.updatedAt.toISOString() })) };
}
export async function getMetadataReview(userId: string) {
  return prisma.$transaction(async tx => publicReviewQueue(buildReviewQueue(await loadReviewSnapshot(tx, userId))), { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}
export type ReviewInput = { id: string; version: string; action: ReviewAction; value?: number; candidateId?: string };
export async function resolveMetadataReview(userId: string, input: ReviewInput) {
  return retryTransaction(() => prisma.$transaction(async tx => {
    const snapshot = await loadReviewSnapshot(tx, userId), queue = buildReviewQueue(snapshot);
    const item = queue.items.find(item => item.id === input.id);
    if (!item) return { error: 'NOT_FOUND' as const };
    if (item.resolved && input.action === 'keep') return { success: true };
    if (item.version !== input.version) return { error: 'STALE_REVIEW' as const };
    if (!item.actions.includes(input.action)) return { error: 'ACTION_NOT_AVAILABLE' as const };
    const target = item.target;
    if (input.action === 'keep' || input.action === 'reopen') {
      const record = snapshot.imports.find(row => row.id === target.importId);
      if (!record) return { error: 'NOT_FOUND' as const };
      const decisions = readReviewDecisions(record.report);
      decisions[item.id] = { fingerprint: item.fingerprint, resolvedAt: new Date(Math.max(Date.now(), decisions[item.id] ? Date.parse(decisions[item.id].resolvedAt) + 1 : 0)).toISOString(), state: input.action === 'reopen' ? 'open' : 'reviewed' };
      await tx.collectionImport.updateMany({ where: { id: record.id, userId }, data: { report: { ...jsonObject(record.report), _metadataReview: decisions } as Prisma.InputJsonValue } });
    } else if (input.action === 'pin') {
      if (!input.candidateId || !item.candidates.some(candidate => candidate.id === input.candidateId) || !target.sourceKey) return { error: 'ACTION_NOT_AVAILABLE' as const };
      if (target.pinKind === 'book') {
        const book = snapshot.books.find(book => book.id === input.candidateId);
        if (!book || (book.importKey && book.importKey !== target.sourceKey)) return { error: 'IDENTITY_CONFLICT' as const };
        const changed = await tx.book.updateMany({ where: { id: book.id, userId, importKey: book.importKey, updatedAt: new Date(book.updatedAt) }, data: { importKey: target.sourceKey } });
        if (!changed.count) return { error: 'STALE_REVIEW' as const };
      } else {
        const work = snapshot.works.find(work => work.id === input.candidateId);
        if (!work || (work.importKey && work.importKey !== target.sourceKey)) return { error: 'IDENTITY_CONFLICT' as const };
        const changed = await tx.work.updateMany({ where: { id: work.id, userId, importKey: work.importKey, updatedAt: new Date(work.updatedAt) }, data: { importKey: target.sourceKey } });
        if (!changed.count) return { error: 'STALE_REVIEW' as const };
      }
    } else if (target.kind === 'entry') {
      const entry = snapshot.entries.find(entry => entry.id === target.id);
      if (!entry) return { error: 'NOT_FOUND' as const };
      const changed = await tx.seriesEntry.updateMany({ where: { id: entry.id, series: { userId }, work: { userId }, position: entry.position === null ? null : new Prisma.Decimal(entry.position), entryType: entry.entryType as SeriesEntryType, isConfirmed: entry.isConfirmed }, data: input.action === 'confirm' ? { isConfirmed: true } : { position: target.position === null ? null : new Prisma.Decimal(target.position!), entryType: target.entryType as SeriesEntryType, isConfirmed: true } });
      if (!changed.count) return { error: 'STALE_REVIEW' as const };
    } else {
      const value = input.action === 'year' ? input.value : target.value;
      if (target.field === 'publicationYear' && (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 9999)) return { error: 'ACTION_NOT_AVAILABLE' as const };
      if (target.kind === 'book') {
        const book = snapshot.books.find(book => book.id === target.id);
        if (!book || !target.field) return { error: 'NOT_FOUND' as const };
        if (target.field === 'readingStatus' && book.readingSessions.length) return { error: 'ACTION_NOT_AVAILABLE' as const };
        const changed = await tx.book.updateMany({ where: { id: book.id, userId, updatedAt: new Date(book.updatedAt) }, data: target.field === 'publicationYear' ? { publicationYear: value as number } : { readingStatus: value as ReadingStatus } });
        if (!changed.count) return { error: 'STALE_REVIEW' as const };
      } else if (target.kind === 'work' && target.field === 'publicationYear') {
        const work = snapshot.works.find(work => work.id === target.id);
        if (!work) return { error: 'NOT_FOUND' as const };
        const changed = await tx.work.updateMany({ where: { id: work.id, userId, updatedAt: new Date(work.updatedAt) }, data: { publicationYear: value as number } });
        if (!changed.count) return { error: 'STALE_REVIEW' as const };
      } else return { error: 'ACTION_NOT_AVAILABLE' as const };
    }
    return { success: true };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }));
}
