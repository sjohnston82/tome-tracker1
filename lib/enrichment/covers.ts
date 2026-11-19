import { prisma } from '@/lib/db'
import { findBookCover } from '@/lib/metadata/covers'

export async function fillMissingCovers(userId: string, after?: string) {
  const books = await prisma.book.findMany({ where: { userId, coverUrl: null, ...(after ? { id: { gt: after } } : {}) }, include: { author: true }, orderBy: { id: 'asc' }, take: 5 })
  let updated = 0
  for (const book of books) {
    const coverUrl = await findBookCover(book.title, book.author.name, book.isbn13)
    if (coverUrl) {
      // A cover selected by the user during lookup must win this race.
      const result = await prisma.book.updateMany({ where: { id: book.id, userId, coverUrl: null }, data: { coverUrl } })
      updated += result.count
    }
    await new Promise(resolve => setTimeout(resolve, 1100))
  }
  return { processed: books.length, updated, next: books.length === 5 ? books.at(-1)!.id : null }
}
