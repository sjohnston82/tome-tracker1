export interface ImportRow {
  title: string;
  author: string;
  isbn?: string;
  seriesName?: string;
  seriesNumber?: number;
  publisher?: string;
  publicationYear?: number;
}

export interface ImportMapping {
  title: string | null;
  author: string | null;
  isbn: string | null;
  seriesName: string | null;
  seriesNumber: string | null;
  publisher: string | null;
  publicationYear: string | null;
}

export interface ImportPreview {
  format: "csv" | "goodreads" | "storygraph";
  totalRows: number;
  columns: string[];
  suggestedMapping: ImportMapping;
  sampleRows: Record<string, string>[];
}

export interface ImportResult {
  imported: number;
  duplicates: number;
  errors: Array<{ row: number; error: string }>;
}
