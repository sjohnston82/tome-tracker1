import { z } from 'zod'
import { prisma } from '@/lib/db'
import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError, checkRateLimit } from '@/lib/api/response'
import { searchCoverOptions, isProviderCover } from '@/lib/metadata/cover-options'

export const maxDuration = 60
const input = z.object({ title: z.string().trim().min(1).max(500), author: z.string().trim().max(200) })
const getId = (request: Request) => new URL(request.url).pathname.split('/').at(-2)!

export const GET = withAuth(async (request, session) => {
  try {
    const book = await prisma.book.findFirst({ where: { id: getId(request), userId: session.userId }, include: { author: true } })
    if (!book) return errorResponse('NOT_FOUND', 'Book not found', 404)
    if (!checkRateLimit(`cover-picker:${session.userId}`, 12, 60000).allowed) return errorResponse('RATE_LIMITED', 'Please wait a minute before searching again.', 429)
    const query = new URL(request.url).searchParams
    const search = input.parse({ title: query.get('title') ?? book.title, author: query.get('author') ?? book.author.name })
    const isbn = search.title === book.title && search.author === book.author.name ? book.isbn13 ?? book.isbn10 : null
    return successResponse(await searchCoverOptions(search.title, search.author, isbn))
  } catch (error) { return handleApiError(error) }
})

export const PATCH = withAuth(async (request, session) => {
  try {
    const body = z.object({ coverUrl: z.string().url().refine(isProviderCover, 'Choose a cover from the search results.').nullable() }).parse(await request.json())
    const result = await prisma.book.updateMany({ where: { id: getId(request), userId: session.userId }, data: { coverUrl: body.coverUrl, coverLocked: true } })
    if (!result.count) return errorResponse('NOT_FOUND', 'Book not found', 404)
    return successResponse({ saved: true })
  } catch (error) { return handleApiError(error) }
})
