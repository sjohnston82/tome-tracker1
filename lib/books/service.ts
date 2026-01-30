import { prisma } from '@/lib/db'
import { CreateBookInput, UpdateBookInput } from './validation'
import { normalizeToIsbn13 } from './isbn'

export async function createBook(userId: string, input: CreateBookInput) {
  const isbn13 = input.isbn13 ? normalizeToIsbn13(input.isbn13) : null

  if (isbn13) {
    const existing = await prisma.book.findUnique({
      where: { userId_isbn13: { userId, isbn13 } },
    })

    if (existing) {
      return { success: false, error: 'DUPLICATE_ISBN', existingBook: existing }
    }
  }

  const author = await prisma.author.upsert({
    where: { userId_name: { userId, name: input.authorName } },
    update: {},
    create: { userId, name: input.authorName },
  })

  const book = await prisma.book.create({
    data: {
      userId,
      authorId: author.id,
      title: input.title,
      isbn13,
      isbn10: input.isbn10,
      publisher: input.publisher,
      publicationYear: input.publicationYear,
      coverUrl: input.coverUrl,
      seriesName: input.seriesName,
      seriesNumber: input.seriesNumber,
      tags: input.tags,
      genres: input.genres,
      source: input.source,
    },
    include: { author: true },
  })

  return { success: true, book }
}

export async function getBookById(userId: string, bookId: string) {
  return prisma.book.findFirst({
    where: { id: bookId, userId },
    include: { author: true },
  })
}

export async function updateBook(
  userId: string,
  bookId: string,
  input: UpdateBookInput
) {
  const existing = await prisma.book.findFirst({
    where: { id: bookId, userId },
  })

  if (!existing) {
    return { success: false, error: 'NOT_FOUND' }
  }

  if (input.isbn13 && input.isbn13 !== existing.isbn13) {
    const duplicate = await prisma.book.findUnique({
      where: { userId_isbn13: { userId, isbn13: input.isbn13 } },
    })

    if (duplicate && duplicate.id !== bookId) {
      return { success: false, error: 'DUPLICATE_ISBN' }
    }
  }

  let authorId = existing.authorId
  if (input.authorName) {
    const author = await prisma.author.upsert({
      where: { userId_name: { userId, name: input.authorName } },
      update: {},
      create: { userId, name: input.authorName },
    })
    authorId = author.id
  }

  const { authorName, ...bookData } = input

  const book = await prisma.book.update({
    where: { id: bookId },
    data: { ...bookData, authorId, updatedAt: new Date() },
    include: { author: true },
  })

  return { success: true, book }
}

export async function deleteBook(userId: string, bookId: string) {
  const existing = await prisma.book.findFirst({
    where: { id: bookId, userId },
  })

  if (!existing) {
    return { success: false, error: 'NOT_FOUND' }
  }

  await prisma.book.delete({ where: { id: bookId } })
  await cleanupOrphanedAuthors(userId)

  return { success: true }
}

async function cleanupOrphanedAuthors(userId: string) {
  await prisma.author.deleteMany({
    where: { userId, books: { none: {} } },
  })
}

export async function checkOwnership(userId: string, isbn13: string) {
  const book = await prisma.book.findUnique({
    where: { userId_isbn13: { userId, isbn13 } },
  })
  return book !== null
}
