import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'
import { prisma } from '@/lib/db'
import { lookupWorkMetadata } from '@/lib/series/metadata'

export const GET = withAuth(async (request, session) => {
  try {
    if (!checkRateLimit(`work-metadata:${session.userId}`, 20, 60000).allowed) return errorResponse('RATE_LIMITED', 'Please wait before requesting more metadata.', 429)
    const parts = request.nextUrl.pathname.split('/')
    const work = await prisma.work.findFirst({ where: { id: parts[parts.length - 2], userId: session.userId }, select: { title: true, authorName: true } })
    if (!work) return errorResponse('NOT_FOUND', 'Work not found', 404)
    return successResponse(await lookupWorkMetadata(work.title, work.authorName))
  } catch (error) { return handleApiError(error) }
})
