import { ImportMapping } from "./types";

export const GOODREADS_MAPPING: ImportMapping = {
  title: "Title",
  author: "Author",
  isbn: "ISBN13",
  seriesName: null,
  seriesNumber: null,
  publisher: "Publisher",
  publicationYear: "Original Publication Year",
};

export function extractSeriesFromTitle(title: string): {
  cleanTitle: string;
  seriesName?: string;
  seriesNumber?: number;
} {
  const match = title.match(
    /^(.+?)\s*\(([^,]+?)(?:,?\s*#?(\d+(?:\.\d+)?))?\)$/
  );

  if (match) {
    return {
      cleanTitle: match[1].trim(),
      seriesName: match[2].trim(),
      seriesNumber: match[3] ? parseFloat(match[3]) : undefined,
    };
  }

  return { cleanTitle: title };
}
