import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'
import { seriesMergeOptions, previewSeriesMerge, applySeriesMerge, mergeInput, MergeError } from '@/lib/series/merge-service'
export const GET = withAuth(async (_request, session) => {
  try { const response = successResponse({ series: await seriesMergeOptions(session.userId) }); response.headers.set('Cache-Control', 'private, no-store'); return response } catch (error) { return handleApiError(error) }
})
export const POST = withAuth(async (request, session) => {
  try {
    if (!checkRateLimit(`series-merge:${session.userId}`, 30, 60000).allowed) return errorResponse('RATE_LIMITED', 'Please wait before reviewing another merge.', 429)
    const input = mergeInput.parse(await request.json())
    const response = successResponse(input.mode === 'preview' ? { preview: await previewSeriesMerge(session.userId, input) } : { merged: await applySeriesMerge(session.userId, input) })
    response.headers.set('Cache-Control', 'private, no-store'); return response
  } catch (error) { return error instanceof MergeError ? errorResponse(error.status === 404 ? 'NOT_FOUND' : 'MERGE_CONFLICT', error.message, error.status) : handleApiError(error) }
})
