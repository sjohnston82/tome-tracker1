import { withAuth } from '@/lib/api/withAuth'
import { getAuthorsWithBookCounts } from '@/lib/authors/service'
import { successResponse, handleApiError } from '@/lib/api/response'

export const GET = withAuth(async (request, session) => {
  try {
    const authors = await getAuthorsWithBookCounts(session.userId)
    return successResponse({ authors })
  } catch (error) {
    return handleApiError(error)
  }
})
