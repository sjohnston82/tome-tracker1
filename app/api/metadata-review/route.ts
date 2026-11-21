import { z } from 'zod';
import { withAuth } from '@/lib/api/withAuth';
import { checkRateLimit, errorResponse, handleApiError, successResponse } from '@/lib/api/response';
import { getMetadataReview, resolveMetadataReview } from '@/lib/review/service';
const schema = z.object({ id: z.string().regex(/^[a-f0-9]{64}$/), version: z.string().regex(/^[a-f0-9]{64}$/), action: z.enum(['keep', 'reopen', 'source', 'year', 'confirm', 'pin']), value: z.number().int().min(1).max(9999).optional(), candidateId: z.string().uuid().optional() }).strict().superRefine((input, ctx) => {
  if ((input.action === 'year') !== (input.value !== undefined) || (input.action === 'pin') !== (input.candidateId !== undefined)) ctx.addIssue({ code: 'custom', message: 'Supply only the value needed for this review action.' });
});
export const GET = withAuth(async (_request, session) => {
  try { const response = successResponse(await getMetadataReview(session.userId)); response.headers.set('Cache-Control', 'private, no-store'); return response; }
  catch (cause) { return handleApiError(cause); }
});
export const PATCH = withAuth(async (request, session) => {
  try {
    if (!checkRateLimit(`metadata-review:${session.userId}`, 60, 60000).allowed) return errorResponse('RATE_LIMITED', 'Too many review changes. Try again shortly.', 429);
    const input = schema.parse(await request.json());
    if (input.action === 'pin' && process.env.COLLECTION_IMPORT_ENABLED !== 'true') return errorResponse('IMPORT_DISABLED', 'Import matching is not enabled in this environment.', 403);
    const result = await resolveMetadataReview(session.userId, input);
    if ('error' in result && result.error) return errorResponse(result.error, result.error === 'NOT_FOUND' ? 'This review item is no longer available.' : result.error === 'IDENTITY_CONFLICT' ? 'That record already belongs to another source row. No identity was replaced.' : 'The item changed or this action is no longer available. Refresh the review list.', result.error === 'NOT_FOUND' ? 404 : 409);
    return successResponse(result);
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'code' in cause && ['P2002', 'P2034'].includes(String(cause.code))) return errorResponse('REVIEW_CONFLICT', 'The catalog changed while saving. Refresh and review again.', 409);
    return handleApiError(cause);
  }
});
