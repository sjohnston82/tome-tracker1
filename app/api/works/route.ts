import { withAuth } from '@/lib/api/withAuth'
import { successResponse, handleApiError } from '@/lib/api/response'
import { createWorkSchema } from '@/lib/series/validation'
import { createWork } from '@/lib/series/service'

export const POST = withAuth(async (request, session) => {
  try {
    const input = createWorkSchema.parse(await request.json())
    return successResponse({ work: await createWork(session.userId, input) }, 201)
  } catch (error) { return handleApiError(error) }
})
