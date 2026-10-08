import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
import { getSeries, updateSeries } from '@/lib/series/service'
import { updateSeriesSchema } from '@/lib/series/validation'

export const GET = withAuth(async (request, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const series = await getSeries(session.userId, id)
    if (!series) return errorResponse('NOT_FOUND', 'Series not found', 404)
    return successResponse({ series })
  } catch (error) { return handleApiError(error) }
})

export const PATCH = withAuth(async (request, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const series = await updateSeries(session.userId, id, updateSeriesSchema.parse(await request.json()))
    if (!series) return errorResponse('NOT_FOUND', 'Series not found', 404)
    return successResponse({ series })
  } catch (error) { return handleApiError(error) }
})
