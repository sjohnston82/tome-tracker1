import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { checkRateLimit, errorResponse, successResponse, handleApiError } from '@/lib/api/response'
import { fillMissingCovers } from '@/lib/enrichment/covers'
export const maxDuration = 60

export const POST = withAuth(async (request, session) => {
  if (!checkRateLimit(`covers:${session.userId}`, 30, 60000).allowed) return errorResponse('RATE_LIMITED', 'Cover lookup is busy. Please try again shortly.', 429)
  try {
    const input = z.object({ after: z.string().uuid().optional() }).parse(await request.json())
    return successResponse(await fillMissingCovers(session.userId, input.after))
  } catch (error) { return handleApiError(error) }
})
