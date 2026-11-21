import { prisma } from '@/lib/db';
import { extractIsbnFromBarcode } from './isbn';
import { matchScannedBooks, type ScanMatchInput } from './scan-matches';

export async function findScanMatches(userId: string, input: ScanMatchInput) {
  const books = await prisma.book.findMany({ where: { userId }, select: {
    id: true, title: true, author: { select: { name: true } }, isbn13: true, isbn10: true,
    publicationYear: true, coverUrl: true, readingStatus: true, updatedAt: true,
  } });
  return matchScannedBooks(input, books.map(book => ({ ...book, updatedAt: book.updatedAt.toISOString() })));
}

export async function linkScannedIsbn(userId: string, bookId: string, isbn: string, expectedUpdatedAt: string) {
  const normalized = extractIsbnFromBarcode(isbn);
  if (!normalized) return { error: 'INVALID_ISBN' as const };
  const book = await prisma.book.findFirst({ where: { id: bookId, userId }, select: { id: true, isbn13: true, isbn10: true, updatedAt: true } });
  if (!book) return { error: 'NOT_FOUND' as const };
  if (book.isbn13 === normalized) return { bookId: book.id, isbn13: normalized, alreadyLinked: true };
  if (book.isbn13 || (book.isbn10 && extractIsbnFromBarcode(book.isbn10) !== normalized)) return { error: 'DIFFERENT_ISBN' as const };
  // Legacy ISBN-10 fields may have hyphens. Normalize all owned identifiers and
  // never disclose another user's copy or create a second ISBN assignment.
  const existing = await prisma.book.findMany({ where: { userId, id: { not: bookId } }, select: { id: true, isbn13: true, isbn10: true } });
  const duplicate = existing.find(item => [item.isbn13, item.isbn10].some(value => value && extractIsbnFromBarcode(value) === normalized));
  if (duplicate) return { error: 'ISBN_IN_USE' as const, existingBookId: duplicate.id };
  try {
    const changed = await prisma.book.updateMany({ where: {
      id: bookId, userId, isbn13: null, isbn10: book.isbn10, updatedAt: new Date(expectedUpdatedAt),
    }, data: { isbn13: normalized } });
    if (!changed.count) return { error: 'STALE_BOOK' as const };
    return { bookId: book.id, isbn13: normalized, alreadyLinked: false };
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'P2002') {
      const duplicate = await prisma.book.findUnique({ where: { userId_isbn13: { userId, isbn13: normalized } }, select: { id: true } });
      return { error: 'ISBN_IN_USE' as const, existingBookId: duplicate?.id };
    }
    throw cause;
  }
}
