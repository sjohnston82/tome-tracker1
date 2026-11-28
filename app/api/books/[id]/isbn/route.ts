import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { checkRateLimit, errorResponse, handleApiError, successResponse } from '@/lib/api/response';
import { extractIsbnFromBarcode } from '@/lib/books/isbn';
import { linkScannedIsbn } from '@/lib/books/scan-service';
const schema = z.object({ isbn: z.string().trim().max(32).refine(value => !!extractIsbnFromBarcode(value), 'Invalid ISBN'), expectedUpdatedAt: z.string().datetime({ offset: true }) }).strict();
export const PATCH = withAuth(async (request: NextRequest, session) => {
  try {
    if (!checkRateLimit(`scan-link:${session.userId}`, 60, 60000).allowed) return errorResponse('RATE_LIMITED', 'Too many linking requests. Try again shortly.', 429);
    const id = z.string().uuid().parse(request.nextUrl.pathname.split('/').at(-2));
    const input = schema.parse(await request.json());
    const result = await linkScannedIsbn(session.userId, id, input.isbn, input.expectedUpdatedAt);
    if ('error' in result) {
      if (result.error === 'NOT_FOUND') return errorResponse('NOT_FOUND', 'Book not found', 404);
      if (result.error === 'ISBN_IN_USE') return errorResponse('ISBN_IN_USE', 'This ISBN is already recorded on another copy in your library.', 409, { existingBookId: result.existingBookId });
      if (result.error === 'DIFFERENT_ISBN') return errorResponse('DIFFERENT_ISBN', 'This copy already has a different ISBN. Review it in your library or add a separate edition.', 409);
      return errorResponse('STALE_BOOK', 'This copy changed since your review. Check matches again before linking.', 409);
    }
    return successResponse(result);
  } catch (cause) { return handleApiError(cause); }
});
