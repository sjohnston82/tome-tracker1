import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
import { removeSeriesEntry, updateSeriesEntry } from '@/lib/series/service'
import { updateSeriesEntrySchema } from '@/lib/series/validation'

export const DELETE = withAuth(async (request, session) => {
  try {
    const parts = request.nextUrl.pathname.split('/')
    const entryId = parts[parts.length - 1]
    const seriesId = parts[parts.length - 3]
    if (!(await removeSeriesEntry(session.userId, seriesId, entryId))) {
      return errorResponse('NOT_FOUND', 'Series entry not found', 404)
    }
    return successResponse({ deleted: true })
  } catch (error) { return handleApiError(error) }
})

export const PATCH = withAuth(async (request, session) => {
  try {
    const parts = request.nextUrl.pathname.split('/')
    const entry = await updateSeriesEntry(session.userId, parts[parts.length - 3], parts[parts.length - 1], updateSeriesEntrySchema.parse(await request.json()))
    if (!entry) return errorResponse('NOT_FOUND', 'Series entry not found', 404)
    return successResponse({ entry })
  } catch (error) { return handleApiError(error) }
})
