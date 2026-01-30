import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import { isPossibleDuplicate, similarity } from "@/lib/books/fuzzy-match";
import { successResponse, errorResponse, handleApiError } from "@/lib/api/response";

const duplicateSchema = z.object({
  title: z.string().min(1),
  authorName: z.string().min(1),
});

export const POST = withAuth(async (request: NextRequest, session) => {
  try {
    const body = await request.json();
    const input = duplicateSchema.parse(body);

    const books = await prisma.book.findMany({
      where: { userId: session.userId },
      include: { author: true },
      take: 500,
      orderBy: { createdAt: "desc" },
    });

    const matches = books
      .map((book) => {
        const titleScore = similarity(input.title, book.title);
        const authorScore = similarity(input.authorName, book.author.name);
        const score = (titleScore + authorScore) / 2;
        return {
          id: book.id,
          title: book.title,
          author: book.author.name,
          score,
        };
      })
      .filter((match) =>
        isPossibleDuplicate(input.title, input.authorName, match.title, match.author, {
          threshold: 0.82,
        })
      )
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return successResponse({ matches });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return errorResponse("INVALID_JSON", "Invalid JSON body", 400);
    }
    return handleApiError(error);
  }
});
