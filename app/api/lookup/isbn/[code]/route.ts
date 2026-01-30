import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { lookupByIsbn } from '@/lib/metadata'
import {
  extractIsbnFromBarcode,
  normalizeToIsbn13,
  isValidIsbn13,
} from '@/lib/books/isbn'
import { checkOwnership } from '@/lib/books/service'
import {
  successResponse,
  errorResponse,
  handleApiError,
  checkRateLimit,
} from '@/lib/api/response'

export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const rateLimit = checkRateLimit(`lookup:${session.userId}`, 30, 60 * 1000)

    if (!rateLimit.allowed) {
      return errorResponse('RATE_LIMITED', 'Too many lookup requests', 429)
    }

    const code = request.nextUrl.pathname.split('/').pop()!

    let isbn = extractIsbnFromBarcode(code)
    if (!isbn) isbn = normalizeToIsbn13(code)

    const response = {
      isIsbn: false,
      normalizedIsbn: null as string | null,
      owned: false,
      metadata: null as any,
    }

    if (!isbn || !isValidIsbn13(isbn)) {
      return successResponse(response)
    }

    response.isIsbn = true
    response.normalizedIsbn = isbn
    response.owned = await checkOwnership(session.userId, isbn)
    response.metadata = await lookupByIsbn(isbn)

    return successResponse(response)
  } catch (error) {
    return handleApiError(error)
  }
})
