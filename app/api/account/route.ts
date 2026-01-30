import { prisma } from "@/lib/db";
import { requireAuth, destroySession } from "@/lib/auth/session";
import { successResponse, handleApiError } from "@/lib/api/response";

// GET /api/account - Get current user info
export async function GET() {
  try {
    const session = await requireAuth();

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        _count: {
          select: { books: true },
        },
      },
    });

    if (!user) {
      throw new Error("Unauthorized");
    }

    return successResponse({
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        bookCount: user._count.books,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

// DELETE /api/account - Delete account and all data
export async function DELETE() {
  try {
    const session = await requireAuth();

    // Hard delete all user data (cascades to books, authors via schema)
    await prisma.user.delete({
      where: { id: session.userId },
    });

    // Clear session
    await destroySession();

    return successResponse({
      message: "Account deleted successfully",
    });
  } catch (error) {
    return handleApiError(error);
  }
}
