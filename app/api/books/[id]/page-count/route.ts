import { withAuth } from '@/lib/api/withAuth'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'
import { lookupPageCounts } from '@/lib/metadata/page-counts'

export const maxDuration = 60
export const GET = withAuth(async (request, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').at(-2)!
    const book = await prisma.book.findFirst({ where: { id, userId: session.userId }, include: { author: true } })
    if (!book) return errorResponse('NOT_FOUND', 'Book not found.', 404)
    if (!checkRateLimit(`page-count:${session.userId}`, 12, 60000).allowed) return errorResponse('RATE_LIMITED', 'Please wait a minute before looking up page counts again.', 429)
    return successResponse(await lookupPageCounts(book.title, book.author.name, book.isbn13 ?? book.isbn10, request.nextUrl.searchParams.get('editions') === 'all'))
  } catch (error) { return handleApiError(error) }
})
