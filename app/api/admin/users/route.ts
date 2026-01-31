import { withAdmin } from "@/lib/api/withAuth";
import { prisma } from "@/lib/db";
import { successResponse, handleApiError } from "@/lib/api/response";

export const GET = withAdmin(async () => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: { books: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return successResponse({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        bookCount: user._count.books,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
});
