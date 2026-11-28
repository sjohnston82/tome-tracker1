import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'
import { getOwnershipReview, changeOwnership, OwnershipError, ownershipInput } from '@/lib/series/ownership-service'
const endpoint = (mutate: boolean) => withAuth(async (request, session) => {
  try {
    const workId = z.string().uuid().parse(request.nextUrl.pathname.split('/').at(-2))
    if (!checkRateLimit(`ownership:${session.userId}`, 90, 60000).allowed) return errorResponse('RATE_LIMITED', 'Please wait before reviewing more ownership links.', 429)
    const review = mutate ? await changeOwnership(session.userId, workId, ownershipInput.parse(await request.json())) : await getOwnershipReview(session.userId, workId)
    const response = successResponse({ review }); response.headers.set('Cache-Control', 'private, no-store'); return response
  } catch (error) { return error instanceof OwnershipError ? errorResponse(error.status === 404 ? 'NOT_FOUND' : 'OWNERSHIP_CONFLICT', error.message, error.status) : handleApiError(error) }
})
export const GET = endpoint(false)
export const POST = endpoint(true)
