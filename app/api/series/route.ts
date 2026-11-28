import { withAuth } from '@/lib/api/withAuth'
import { successResponse, handleApiError } from '@/lib/api/response'
import { createSeriesSchema } from '@/lib/series/validation'
import { createSeries, listSeries } from '@/lib/series/service'

export const GET = withAuth(async (_request, session) => {
  try {
    return successResponse({ series: await listSeries(session.userId) })
  } catch (error) { return handleApiError(error) }
})

export const POST = withAuth(async (request, session) => {
  try {
    const input = createSeriesSchema.parse(await request.json())
    return successResponse({ series: await createSeries(session.userId, input) }, 201)
  } catch (error) { return handleApiError(error) }
})
