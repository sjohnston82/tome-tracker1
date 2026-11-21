import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, checkRateLimit } from '@/lib/api/response'
import { prisma } from '@/lib/db'
import { referenceCover } from '@/lib/series/reference-cover'

export const GET = withAuth(async (request, session) => {
  const id = request.nextUrl.pathname.split('/').at(-2)
  const work = await prisma.work.findFirst({ where: { id, userId: session.userId }, select: { title: true, authorName: true, updatedAt: true } })
  if (!work) return errorResponse('NOT_FOUND', 'Work not found', 404)
  if (!checkRateLimit(`series-cover:${session.userId}`, 120, 60000).allowed) return errorResponse('RATE_LIMITED', 'Please wait before looking up more covers.', 429)
  try {
    const coverUrl = await referenceCover(`${session.userId}:${id}:${work.updatedAt.toISOString()}`, work.title, work.authorName)
    const response = successResponse({ coverUrl })
    response.headers.set('Cache-Control', 'private, no-store')
    return response
  } catch {
    return errorResponse('COVER_UNAVAILABLE', 'Reference cover lookup is temporarily unavailable.', 503)
  }
})
