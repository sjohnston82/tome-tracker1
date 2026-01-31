import { withAuth } from "@/lib/api/withAuth";
import { enrichUserBooks } from "@/lib/enrichment/service";
import {
  successResponse,
  errorResponse,
  handleApiError,
  checkRateLimit,
} from "@/lib/api/response";

export const POST = withAuth(async (request, session) => {
  try {
    const rateLimit = checkRateLimit(`enrich:${session.userId}`, 1, 5 * 60 * 1000);

    if (!rateLimit.allowed) {
      return errorResponse("RATE_LIMITED", "Enrichment already in progress", 429);
    }

    const result = await enrichUserBooks(session.userId);

    return successResponse({ result });
  } catch (error) {
    return handleApiError(error);
  }
});
