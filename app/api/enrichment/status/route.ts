import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api/response";

export const GET = withAuth(async (request, session) => {
  try {
    const needsEnrichment = await prisma.book.count({
      where: {
        userId: session.userId,
        isbn13: { not: null },
        OR: [{ coverUrl: null }, { publisher: null }],
      },
    });

    return successResponse({
      needsEnrichment,
      canEnrich: needsEnrichment > 0,
    });
  } catch (error) {
    return handleApiError(error);
  }
});
