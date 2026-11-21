import { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { checkRateLimit, errorResponse, handleApiError, successResponse } from '@/lib/api/response';
import { extractIsbnFromBarcode } from '@/lib/books/isbn';
import { findScanMatches } from '@/lib/books/scan-service';
const schema = z.object({
  isbn: z.string().trim().max(32).refine(value => !!extractIsbnFromBarcode(value), 'Invalid ISBN').optional().nullable(),
  title: z.string().trim().min(1).max(500).optional(),
  authors: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
}).strict().refine(value => !!value.isbn || !!value.title, 'An ISBN or title is required');
export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    if (!checkRateLimit(`scan-matches:${session.userId}`, 60, 60000).allowed) return errorResponse('RATE_LIMITED', 'Too many matching requests. Try again shortly.', 429);
    const input = schema.parse(await request.json());
    const response = successResponse(await findScanMatches(session.userId, input));
    response.headers.set('Cache-Control', 'private, no-store');
    return response;
  } catch (cause) { return handleApiError(cause); }
});
