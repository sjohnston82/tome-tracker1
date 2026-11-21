import { withAuth } from '@/lib/api/withAuth'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'
import { lookupPageCounts } from '@/lib/metadata/page-counts'
import { z } from 'zod'
import { isValidIsbn10, isValidIsbn13 } from '@/lib/books/isbn'

export const maxDuration = 60
export const GET = withAuth(async (request, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').at(-2)!
    const book = await prisma.book.findFirst({ where: { id, userId: session.userId }, include: { author: true } })
    if (!book) return errorResponse('NOT_FOUND', 'Book not found.', 404)
    if (!checkRateLimit(`page-count:${session.userId}`, 12, 60000).allowed) return errorResponse('RATE_LIMITED', 'Please wait a minute before looking up page counts again.', 429)
    const query = request.nextUrl.searchParams
    const offset = z.coerce.number().int().min(0).max(270).parse(query.get('offset') ?? 0)
    const custom = query.has('isbn') ? (query.get('isbn') ?? '').replace(/[-\s]/g, '').toUpperCase() : null
    if (custom && !isValidIsbn10(custom) && !isValidIsbn13(custom)) return errorResponse('INVALID_ISBN', 'Enter a valid ISBN-10 or ISBN-13, or leave it blank to browse by title.', 400)
    const isbn = custom === null ? book.isbn13 ?? book.isbn10 : custom || null
    const all = query.get('editions') === 'all'
    return successResponse(await (offset ? lookupPageCounts(book.title, book.author.name, isbn, all, offset) : lookupPageCounts(book.title, book.author.name, isbn, all)))
  } catch (error) { return handleApiError(error) }
})
