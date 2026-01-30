import { prisma } from '@/lib/db'

export interface LibrarySnapshot {
  syncedAt: string
  authors: AuthorWithBooks[]
}

export interface AuthorWithBooks {
  id: string
  name: string
  bio: string | null
  photoUrl: string | null
  books: BookSummary[]
}

export interface BookSummary {
  id: string
  title: string
  isbn13: string | null
  isbn10: string | null
  publisher: string | null
  publicationYear: number | null
  coverUrl: string | null
  seriesName: string | null
  seriesNumber: number | null
  tags: string[]
  genres: string[]
  source: string
  createdAt: string
  updatedAt: string
}

export async function getLibrarySnapshot(userId: string): Promise<LibrarySnapshot> {
  const authors = await prisma.author.findMany({
    where: {
      userId,
      books: { some: {} },
    },
    include: {
      books: {
        orderBy: [
          { seriesName: 'asc' },
          { seriesNumber: 'asc' },
          { title: 'asc' },
        ],
      },
    },
    orderBy: { name: 'asc' },
  })

  return {
    syncedAt: new Date().toISOString(),
    authors: authors.map((author) => ({
      id: author.id,
      name: author.name,
      bio: author.bio,
      photoUrl: author.photoUrl,
      books: author.books.map((book) => ({
        id: book.id,
        title: book.title,
        isbn13: book.isbn13,
        isbn10: book.isbn10,
        publisher: book.publisher,
        publicationYear: book.publicationYear,
        coverUrl: book.coverUrl,
        seriesName: book.seriesName,
        seriesNumber: book.seriesNumber,
        tags: book.tags,
        genres: book.genres,
        source: book.source,
        createdAt: book.createdAt.toISOString(),
        updatedAt: book.updatedAt.toISOString(),
      })),
    })),
  }
}

export async function getLibraryStats(userId: string) {
  const [bookCount, authorCount] = await Promise.all([
    prisma.book.count({ where: { userId } }),
    prisma.author.count({ where: { userId, books: { some: {} } } }),
  ])

  return { bookCount, authorCount }
}
