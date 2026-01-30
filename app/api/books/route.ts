import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { createBookSchema } from '@/lib/books/validation'
import { createBook } from '@/lib/books/service'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'

export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const body = await request.json()
    const input = createBookSchema.parse(body)

    const result = await createBook(session.userId, input)

    if (!result.success) {
      if (result.error === 'DUPLICATE_ISBN') {
        return errorResponse(
          'DUPLICATE_ISBN',
          'You already own this book',
          409,
          { existingBookId: result.existingBook?.id }
        )
      }
    }

    return successResponse({ book: result.book }, 201)
  } catch (error) {
    return handleApiError(error)
  }
})
