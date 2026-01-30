import { NextRequest } from 'next/server'
import { withAuth } from '@/lib/api/withAuth'
import { getBookById, updateBook, deleteBook } from '@/lib/books/service'
import { updateBookSchema } from '@/lib/books/validation'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'

export const GET = withAuth(async (request: NextRequest, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const book = await getBookById(session.userId, id)

    if (!book) {
      return errorResponse('NOT_FOUND', 'Book not found', 404)
    }

    return successResponse({ book })
  } catch (error) {
    return handleApiError(error)
  }
})

export const PATCH = withAuth(async (request: NextRequest, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const body = await request.json()
    const input = updateBookSchema.parse(body)

    const result = await updateBook(session.userId, id, input)

    if (!result.success) {
      if (result.error === 'NOT_FOUND') {
        return errorResponse('NOT_FOUND', 'Book not found', 404)
      }
      if (result.error === 'DUPLICATE_ISBN') {
        return errorResponse('DUPLICATE_ISBN', 'ISBN already exists', 409)
      }
    }

    return successResponse({ book: result.book })
  } catch (error) {
    return handleApiError(error)
  }
})

export const DELETE = withAuth(async (request: NextRequest, session) => {
  try {
    const id = request.nextUrl.pathname.split('/').pop()!
    const result = await deleteBook(session.userId, id)

    if (!result.success) {
      return errorResponse('NOT_FOUND', 'Book not found', 404)
    }

    return successResponse({ success: true })
  } catch (error) {
    return handleApiError(error)
  }
})
