import { prisma } from "@/lib/db";
import { lookupByIsbn } from "@/lib/metadata";

interface EnrichmentResult {
  processed: number;
  enriched: number;
  errors: number;
}

export async function enrichUserBooks(userId: string): Promise<EnrichmentResult> {
  const result: EnrichmentResult = {
    processed: 0,
    enriched: 0,
    errors: 0,
  };

  const booksToEnrich = await prisma.book.findMany({
    where: {
      userId,
      isbn13: { not: null },
      OR: [{ coverUrl: null }, { publisher: null }],
    },
    take: 20,
  });

  for (const book of booksToEnrich) {
    result.processed += 1;

    try {
      if (!book.isbn13) continue;

      const metadata = await lookupByIsbn(book.isbn13);
      if (!metadata) continue;

      const updates: Record<string, any> = {};

      if (!book.coverUrl && metadata.coverUrl) {
        updates.coverUrl = metadata.coverUrl;
      }
      if (!book.publisher && metadata.publisher) {
        updates.publisher = metadata.publisher;
      }
      if (!book.publicationYear && metadata.publishedYear) {
        updates.publicationYear = metadata.publishedYear;
      }
      if (book.genres.length === 0 && metadata.subjects?.length) {
        updates.genres = metadata.subjects.slice(0, 10);
      }

      if (Object.keys(updates).length > 0) {
        await prisma.book.update({
          where: { id: book.id },
          data: updates,
        });
        result.enriched += 1;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(`Enrichment error for book ${book.id}:`, error);
      result.errors += 1;
    }
  }

  return result;
}
