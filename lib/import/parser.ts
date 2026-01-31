import Papa from "papaparse";
import { ImportMapping, ImportPreview, ImportRow } from "./types";

const COLUMN_MAPPINGS = {
  title: ["title", "book title", "name", "book name"],
  author: ["author", "author name", "authors", "author(s)", "writer"],
  isbn: ["isbn", "isbn13", "isbn-13", "isbn10", "isbn-10", "asin"],
  seriesName: ["series", "series name", "series title"],
  seriesNumber: ["series number", "book number", "number in series", "#"],
  publisher: ["publisher", "publishing company"],
  publicationYear: ["year", "publication year", "year published", "original publication year"],
};

export function detectFormat(headers: string[]): "goodreads" | "storygraph" | "csv" {
  const headerSet = new Set(headers.map((header) => header.toLowerCase()));

  if (headerSet.has("book id") && headerSet.has("bookshelves")) {
    return "goodreads";
  }

  if (headerSet.has("read status") && headerSet.has("star rating")) {
    return "storygraph";
  }

  return "csv";
}

export function suggestMapping(headers: string[]): ImportMapping {
  const mapping: ImportMapping = {
    title: null,
    author: null,
    isbn: null,
    seriesName: null,
    seriesNumber: null,
    publisher: null,
    publicationYear: null,
  };

  const lowerHeaders = headers.map((header) => header.toLowerCase().trim());

  for (const [field, aliases] of Object.entries(COLUMN_MAPPINGS)) {
    for (const alias of aliases) {
      const index = lowerHeaders.findIndex(
        (header) => header === alias || header.includes(alias)
      );
      if (index !== -1) {
        (mapping as any)[field] = headers[index];
        break;
      }
    }
  }

  return mapping;
}

export async function parseCSVText(
  text: string
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (results.errors.length > 0) {
          reject(new Error(results.errors[0].message));
          return;
        }

        const headers = results.meta.fields || [];
        resolve({
          headers,
          rows: results.data as Record<string, string>[],
        });
      },
      error: (error) => {
        reject(error);
      },
    });
  });
}

export async function parseCSV(
  file: File
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const text = buffer.toString("utf-8");
  return parseCSVText(text);
}

export function applyMapping(
  row: Record<string, string>,
  mapping: ImportMapping
): ImportRow | null {
  const title = mapping.title ? row[mapping.title]?.trim() : null;
  const author = mapping.author ? row[mapping.author]?.trim() : null;

  if (!title || !author) {
    return null;
  }

  return {
    title,
    author,
    isbn: mapping.isbn ? row[mapping.isbn]?.trim() : undefined,
    seriesName: mapping.seriesName ? row[mapping.seriesName]?.trim() : undefined,
    seriesNumber: mapping.seriesNumber
      ? parseFloat(row[mapping.seriesNumber]) || undefined
      : undefined,
    publisher: mapping.publisher ? row[mapping.publisher]?.trim() : undefined,
    publicationYear: mapping.publicationYear
      ? parseInt(row[mapping.publicationYear], 10) || undefined
      : undefined,
  };
}

export async function createPreview(file: File): Promise<ImportPreview> {
  const { headers, rows } = await parseCSV(file);
  return buildPreview(headers, rows);
}

export async function createPreviewFromText(text: string): Promise<ImportPreview> {
  const { headers, rows } = await parseCSVText(text);
  return buildPreview(headers, rows);
}

function buildPreview(
  headers: string[],
  rows: Record<string, string>[]
): ImportPreview {
  const format = detectFormat(headers);
  const suggestedMapping = suggestMapping(headers);

  return {
    format,
    totalRows: rows.length,
    columns: headers,
    suggestedMapping,
    sampleRows: rows.slice(0, 5),
  };
}
