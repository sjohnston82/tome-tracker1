import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
import { createSeriesEntrySchema } from '@/lib/series/validation'
import { addSeriesEntry } from '@/lib/series/service'

export const POST = withAuth(async (request, session) => {
  try {
    const parts = request.nextUrl.pathname.split('/')
    const seriesId = parts[parts.length - 2]
    const input = createSeriesEntrySchema.parse(await request.json())
    const result = await addSeriesEntry(session.userId, seriesId, input)
    if (result.error === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Series or work not found', 404)
    if (result.error === 'DUPLICATE') return errorResponse('DUPLICATE', 'Work already belongs to this series', 409)
    return successResponse({ entry: result.entry }, 201)
  } catch (error) { return handleApiError(error) }
})
