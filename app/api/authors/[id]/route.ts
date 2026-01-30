import { NextRequest } from 'next/server'
import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { getAuthorWithBooks, updateAuthor } from '@/lib/authors/service'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'

const updateAuthorSchema = z.object({
  bio: z.string().max(2000).optional().nullable(),
  photoUrl: z.string().url().optional().nullable(),
})

export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const author = await getAuthorWithBooks(session.userId, id)

    if (!author) {
      return errorResponse('NOT_FOUND', 'Author not found', 404)
    }

    return successResponse({ author })
  } catch (error) {
    return handleApiError(error)
  }
})

export const PATCH = withAuth(async (request: NextRequest, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const body = await request.json()
    const data = updateAuthorSchema.parse(body)

    const author = await updateAuthor(session.userId, id, data)

    if (!author) {
      return errorResponse('NOT_FOUND', 'Author not found', 404)
    }

    return successResponse({ author })
  } catch (error) {
    return handleApiError(error)
  }
})
