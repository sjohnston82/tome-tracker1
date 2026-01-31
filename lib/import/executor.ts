import { prisma } from "@/lib/db";
import { ImportMapping, ImportResult } from "./types";
import { applyMapping } from "./parser";
import { normalizeToIsbn13 } from "@/lib/books/isbn";
import { extractSeriesFromTitle } from "./goodreads";

export async function executeImport(
  userId: string,
  rows: Record<string, string>[],
  mapping: ImportMapping,
  format: "csv" | "goodreads" | "storygraph"
): Promise<ImportResult> {
  const result: ImportResult = {
    imported: 0,
    duplicates: 0,
    errors: [],
  };

  const existingBooks = await prisma.book.findMany({
    where: { userId },
    select: { isbn13: true },
  });
  const existingIsbns = new Set(
    existingBooks.map((book) => book.isbn13).filter(Boolean)
  );

  for (let i = 0; i < rows.length; i += 1) {
    try {
      let importRow = applyMapping(rows[i], mapping);

      if (!importRow) {
        result.errors.push({
          row: i + 1,
          error: "Missing required fields (title or author)",
        });
        continue;
      }

      if (format === "goodreads" && importRow.title) {
        const { cleanTitle, seriesName, seriesNumber } = extractSeriesFromTitle(
          importRow.title
        );
        importRow = {
          ...importRow,
          title: cleanTitle,
          seriesName: seriesName || importRow.seriesName,
          seriesNumber: seriesNumber || importRow.seriesNumber,
        };
      }

      const isbn13 = importRow.isbn ? normalizeToIsbn13(importRow.isbn) : null;

      if (isbn13 && existingIsbns.has(isbn13)) {
        result.duplicates += 1;
        continue;
      }

      const author = await prisma.author.upsert({
        where: {
          userId_name: { userId, name: importRow.author },
        },
        update: {},
        create: {
          userId,
          name: importRow.author,
        },
      });

      await prisma.book.create({
        data: {
          userId,
          authorId: author.id,
          title: importRow.title,
          isbn13,
          publisher: importRow.publisher,
          publicationYear: importRow.publicationYear,
          seriesName: importRow.seriesName,
          seriesNumber: importRow.seriesNumber,
          source: "IMPORT",
        },
      });

      if (isbn13) {
        existingIsbns.add(isbn13);
      }

      result.imported += 1;
    } catch (error) {
      result.errors.push({
        row: i + 1,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  return result;
}
