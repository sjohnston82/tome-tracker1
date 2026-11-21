import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
import { getReading, recordReading, ReadingError } from '@/lib/reading/service'
import { readingInput } from '@/lib/reading/validation'

const id = (request: Request) => new URL(request.url).pathname.split('/').at(-2)!
export const GET = withAuth(async (request, session) => {
  try {
    const result = await getReading(session.userId, id(request))
    return result ? successResponse(result) : errorResponse('NOT_FOUND', 'Book not found.', 404)
  } catch (error) { return handleApiError(error) }
})
export const POST = withAuth(async (request, session) => {
  try {
    const text = await request.text()
    if (text.length > 10000) return errorResponse('TOO_LARGE', 'Reading entry is too large.', 413)
    return successResponse(await recordReading(session.userId, id(request), readingInput.parse(JSON.parse(text))))
  } catch (error) {
    if (error instanceof ReadingError) return errorResponse('READING_ERROR', error.message, error.status)
    if (typeof error === 'object' && error !== null && 'code' in error && ['P2034', 'P2002'].includes(String(error.code))) return errorResponse('READING_CONFLICT', 'The reading log changed. Refresh and retry.', 409)
    return handleApiError(error)
  }
})
