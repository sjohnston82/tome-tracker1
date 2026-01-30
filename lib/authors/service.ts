import { prisma } from "@/lib/db";

export async function getAuthorsWithBookCounts(userId: string) {
  const authors = await prisma.author.findMany({
    where: { userId, books: { some: {} } },
    include: { _count: { select: { books: true } } },
    orderBy: { name: "asc" },
  });

  return authors.map((author) => ({
    id: author.id,
    name: author.name,
    photoUrl: author.photoUrl,
    bookCount: author._count.books,
  }));
}

export async function getAuthorWithBooks(userId: string, authorId: string) {
  return prisma.author.findFirst({
    where: { id: authorId, userId },
    include: {
      books: {
        orderBy: [
          { seriesName: "asc" },
          { seriesNumber: "asc" },
          { title: "asc" },
        ],
      },
    },
  });
}

export async function updateAuthor(
  userId: string,
  authorId: string,
  data: { bio?: string | null; photoUrl?: string | null }
) {
  const existing = await prisma.author.findFirst({
    where: { id: authorId, userId },
  });

  if (!existing) return null;

  return prisma.author.update({
    where: { id: authorId },
    data,
  });
}
