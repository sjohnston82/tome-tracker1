import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { normalizeToIsbn13 } from '@/lib/books/isbn'
import { prisma } from '@/lib/db'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'

export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const isbn = request.nextUrl.searchParams.get('isbn')

    if (!isbn) {
      return errorResponse('MISSING_ISBN', 'ISBN parameter is required', 400)
    }

    const normalized = normalizeToIsbn13(isbn)

    if (!normalized) {
      return successResponse({ owned: false, validIsbn: false })
    }

    const book = await prisma.book.findUnique({
      where: { userId_isbn13: { userId: session.userId, isbn13: normalized } },
      select: { id: true },
    })

    return successResponse({
      owned: book !== null,
      bookId: book?.id || null,
      validIsbn: true,
      normalizedIsbn: normalized,
    })
  } catch (error) {
    return handleApiError(error)
  }
})
