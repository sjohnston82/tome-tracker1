import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
import { getSeries } from '@/lib/series/service'

export const GET = withAuth(async (request, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const series = await getSeries(session.userId, id)
    if (!series) return errorResponse('NOT_FOUND', 'Series not found', 404)
    return successResponse({ series })
  } catch (error) { return handleApiError(error) }
})
