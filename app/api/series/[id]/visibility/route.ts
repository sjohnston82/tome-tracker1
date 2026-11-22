import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'
import { setSeriesVisibility, visibilityInput, VisibilityError } from '@/lib/series/visibility-service'
export const PATCH = withAuth(async (request, session) => {
  try {
    const id = z.string().uuid().parse(request.nextUrl.pathname.split('/').at(-2))
    if (!checkRateLimit(`series-visibility:${session.userId}`, 90, 60000).allowed) return errorResponse('RATE_LIMITED', 'Please wait before changing more shelf preferences.', 429)
    const preference = await setSeriesVisibility(session.userId, id, visibilityInput.parse(await request.json()))
    const response = successResponse({ preference }); response.headers.set('Cache-Control', 'private, no-store'); return response
  } catch (error) { return error instanceof VisibilityError ? errorResponse(error.status === 404 ? 'NOT_FOUND' : 'STALE_PREFERENCE', error.message, error.status) : handleApiError(error) }
})
