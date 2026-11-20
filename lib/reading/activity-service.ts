import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { buildReadingActivity } from './activity';

export async function getReadingActivity(userId: string, year: number, timeZone: string) {
  return prisma.$transaction(async tx => {
    const [sessions, undated] = await Promise.all([
      tx.readingSession.findMany({
        where: { book: { userId } },
        select: { id: true, baselinePage: true, finishedAt: true, book: { select: { id: true, title: true, author: { select: { name: true } } } }, logs: { select: { id: true, page: true, occurredAt: true, createdAt: true } } },
      }),
      tx.book.count({ where: { userId, readingStatus: 'READ', readingSessions: { none: { finishedAt: { not: null } } } } }),
    ]);
    return buildReadingActivity(sessions.map(session => ({ ...session, finishedAt: session.finishedAt?.toISOString() ?? null, logs: session.logs.map(log => ({ ...log, occurredAt: log.occurredAt.toISOString(), createdAt: log.createdAt.toISOString() })) })), year, timeZone, undated);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 30000 });
}
