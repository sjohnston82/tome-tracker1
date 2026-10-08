import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
import { linkEdition, unlinkEdition } from '@/lib/series/service'

const inputSchema = z.object({ bookId: z.string().uuid() })
export const POST = withAuth(async (request, session) => {
  try {
    const parts = request.nextUrl.pathname.split('/')
    const { bookId } = inputSchema.parse(await request.json())
    const link = await linkEdition(session.userId, parts[parts.length - 2], bookId)
    if (!link) return errorResponse('NOT_FOUND', 'Work or physical book not found', 404)
    return successResponse({ link })
  } catch (error) { return handleApiError(error) }
})
export const DELETE = withAuth(async (request, session) => {
  try {
    const parts = request.nextUrl.pathname.split('/')
    const { bookId } = inputSchema.parse(await request.json())
    if (!(await unlinkEdition(session.userId, parts[parts.length - 2], bookId))) return errorResponse('NOT_FOUND', 'Edition link not found', 404)
    return successResponse({ unlinked: true })
  } catch (error) { return handleApiError(error) }
})
