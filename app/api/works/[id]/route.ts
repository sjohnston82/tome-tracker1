import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
import { updateWork } from '@/lib/series/service'
import { updateWorkSchema } from '@/lib/series/validation'

export const PATCH = withAuth(async (request, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const work = await updateWork(session.userId, id, updateWorkSchema.parse(await request.json()))
    if (!work) return errorResponse('NOT_FOUND', 'Work not found', 404)
    return successResponse({ work })
  } catch (error) { return handleApiError(error) }
})
