export interface User {
  id: string;
  email: string;
  role: "USER" | "ADMIN";
  createdAt: string;
}

export interface Author {
  id: string;
  name: string;
  bio: string | null;
  photoUrl: string | null;
}

export interface Book {
  id: string;
  title: string;
  isbn13: string | null;
  isbn10: string | null;
  publisher: string | null;
  publicationYear: number | null;
  coverUrl: string | null;
  seriesName: string | null;
  seriesNumber: number | null;
  tags: string[];
  genres: string[];
  source: "SCAN" | "MANUAL" | "IMPORT";
  author: Author;
  createdAt: string;
  updatedAt: string;
}
