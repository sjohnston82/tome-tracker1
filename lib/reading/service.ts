import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { ReadingInput } from './validation'

const include = { logs: { orderBy: [{ occurredAt: 'asc' as const }, { createdAt: 'asc' as const }, { id: 'asc' as const }] } }
export class ReadingError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
const reject = (message: string, status = 400): never => { throw new ReadingError(status, message) }

export async function getReading(userId: string, bookId: string) {
  const book = await prisma.book.findFirst({ where: { id: bookId, userId }, select: { id: true } })
  if (!book) return null
  return { session: await prisma.readingSession.findFirst({ where: { bookId }, orderBy: [{ trackedAt: 'desc' }, { id: 'desc' }], include }) }
}

export async function recordReading(userId: string, bookId: string, input: ReadingInput) {
  return prisma.$transaction(async tx => {
    const book = await tx.book.findFirst({ where: { id: bookId, userId } })
    if (!book) return reject('Book not found.', 404)
    const session = await tx.readingSession.findFirst({ where: { bookId }, orderBy: [{ trackedAt: 'desc' }, { id: 'desc' }], include })
    if (input.action === 'start') {
      if (session && !session.finishedAt) return reject('This book already has a reading log. Refresh to continue it.', 409)
      if (!['UNREAD', 'READING'].includes(book.readingStatus)) return reject('Start tracking an unread or currently reading book. Previously read books remain undated.')
      if (input.totalPages !== null && input.page > input.totalPages) return reject('The starting page cannot exceed the total pages.')
      const created = await tx.readingSession.create({ data: { bookId, baselinePage: input.page, totalPages: input.totalPages, startedAt: book.readingStatus === 'UNREAD' && input.page === 0 ? new Date(Math.floor(Date.now() / 60000) * 60000) : null }, include })
      await tx.book.update({ where: { id: bookId }, data: { readingStatus: 'READING' } })
      return { session: created }
    }
    if (!session || session.id !== input.sessionId) return reject('Reading session not found.', 404)
    // A retried request must not create another entry, even after its version advanced.
    if (input.action === 'log' && session.logs.some(log => log.requestId === input.requestId)) return { session }
    if (session.version !== input.version) return reject('This reading log changed elsewhere. Refresh before saving again.', 409)
    let finishedAt = session.finishedAt
    if (input.action === 'settings') {
      if (session.logs.some(log => log.page < input.baselinePage)) return reject('The starting page cannot exceed an existing logged page.')
      const highest = Math.max(input.baselinePage, ...session.logs.map(log => log.page))
      if (input.totalPages !== null && input.totalPages < highest) return reject('Total pages cannot be below a recorded page.')
      return { session: await tx.readingSession.update({ where: { id: session.id }, data: { baselinePage: input.baselinePage, totalPages: input.totalPages, version: { increment: 1 } }, include }) }
    }
    if (input.action === 'delete') {
      const entry = session.logs.find(log => log.id === input.entryId)
      if (!entry) return reject('Reading entry not found.', 404)
      await tx.readingLog.delete({ where: { id: entry.id } })
      if (entry.isCompletion) {
        finishedAt = null
        await tx.book.update({ where: { id: bookId }, data: { readingStatus: 'READING' } })
      }
    } else {
      if (input.page < session.baselinePage) return reject('The page cannot be below your starting point. Correct the starting point first.')
      if (session.totalPages !== null && input.page > session.totalPages) return reject('The page exceeds this edition’s total. Correct the total first.')
      const occurredAt = new Date(input.occurredAt)
      const firstMinute = Math.floor(session.trackedAt.getTime() / 60000) * 60000
      if (occurredAt.getTime() < firstMinute) return reject('Progress must be logged after tracking began; earlier pages are not estimated.')
      if (occurredAt.getTime() > Date.now() + 60000) return reject('The reading time cannot be in the future.')
      if (input.action === 'log') {
        if (finishedAt) return reject('This reading session is already finished.', 409)
        if (session.logs.length >= 10000) return reject('This reading session has reached its entry limit.')
        if (input.finish && session.logs.some(log => log.page > input.page || log.occurredAt > occurredAt)) return reject('Completion must be after all other entries and at or beyond their pages.')
        await tx.readingLog.create({ data: { sessionId: session.id, requestId: input.requestId, page: input.page, occurredAt, note: input.note, isCompletion: input.finish } })
        if (input.finish) {
          finishedAt = occurredAt
          await tx.book.update({ where: { id: bookId }, data: { readingStatus: 'READ' } })
        }
      } else {
        const entry = session.logs.find(log => log.id === input.entryId)
        if (!entry) return reject('Reading entry not found.', 404)
        if (entry.isCompletion) {
          if (session.logs.some(log => log.id !== entry.id && (log.page > input.page || log.occurredAt > occurredAt))) return reject('Completion must stay after all other entries.')
          finishedAt = occurredAt
        } else if (finishedAt && (occurredAt > finishedAt || input.page > (session.logs.find(log => log.isCompletion)?.page ?? Infinity))) return reject('An entry cannot be later than completion or exceed its final page.')
        await tx.readingLog.update({ where: { id: entry.id }, data: { page: input.page, occurredAt, note: input.note } })
      }
    }
    return { session: await tx.readingSession.update({ where: { id: session.id }, data: { finishedAt, version: { increment: 1 } }, include }) }
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
}
