import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { searchBooks } from '@/lib/metadata'
import {
  successResponse,
  errorResponse,
  handleApiError,
  checkRateLimit,
} from '@/lib/api/response'

export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const rateLimit = checkRateLimit(`search:${session.userId}`, 20, 60 * 1000)

    if (!rateLimit.allowed) {
      return errorResponse('RATE_LIMITED', 'Too many search requests', 429)
    }

    const query = request.nextUrl.searchParams.get('q')

    if (!query || query.trim().length < 2) {
      return errorResponse(
        'INVALID_QUERY',
        'Search query must be at least 2 characters',
        400
      )
    }

    const results = await searchBooks(query.trim())

    return successResponse({ results })
  } catch (error) {
    return handleApiError(error)
  }
})
