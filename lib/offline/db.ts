import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface LibraryDB extends DBSchema {
  authors: {
    key: string;
    value: {
      id: string;
      name: string;
      bio: string | null;
      photoUrl: string | null;
    };
    indexes: { "by-name": string };
  };
  books: {
    key: string;
    value: {
      id: string;
      authorId: string;
      title: string;
      isbn13: string | null;
      coverUrl: string | null;
      seriesName: string | null;
      seriesNumber: number | null;
    };
    indexes: { "by-author": string; "by-isbn": string };
  };
  metadata: {
    key: string;
    value: {
      key: string;
      value: string;
      updatedAt: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<LibraryDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<LibraryDB>("tome-tracker", 1, {
      upgrade(db) {
        const authorStore = db.createObjectStore("authors", { keyPath: "id" });
        authorStore.createIndex("by-name", "name");

        const bookStore = db.createObjectStore("books", { keyPath: "id" });
        bookStore.createIndex("by-author", "authorId");
        bookStore.createIndex("by-isbn", "isbn13");

        db.createObjectStore("metadata", { keyPath: "key" });
      },
    });
  }
  return dbPromise;
}

export async function cacheLibraryData(
  authors: LibraryDB["authors"]["value"][],
  books: LibraryDB["books"]["value"][]
) {
  const db = await getDB();
  const tx = db.transaction(["authors", "books", "metadata"], "readwrite");

  await tx.objectStore("authors").clear();
  await tx.objectStore("books").clear();

  for (const author of authors) {
    await tx.objectStore("authors").put(author);
  }

  for (const book of books) {
    await tx.objectStore("books").put(book);
  }

  const now = new Date().toISOString();
  await tx.objectStore("metadata").put({
    key: "lastSync",
    value: now,
    updatedAt: now,
  });

  await tx.done;
}

export async function getCachedLibrary() {
  const db = await getDB();

  const [authors, books, syncMeta] = await Promise.all([
    db.getAll("authors"),
    db.getAll("books"),
    db.get("metadata", "lastSync"),
  ]);

  return {
    authors,
    books,
    lastSync: syncMeta?.value || null,
  };
}

export async function checkOwnershipOffline(isbn13: string): Promise<boolean> {
  const db = await getDB();
  const book = await db.getFromIndex("books", "by-isbn", isbn13);
  return book !== null;
}

export async function searchBooksOffline(query: string) {
  const db = await getDB();
  const books = await db.getAll("books");
  const authors = await db.getAll("authors");

  const authorMap = new Map(authors.map((author) => [author.id, author]));
  const lowerQuery = query.toLowerCase();

  return books.filter((book) => {
    const author = authorMap.get(book.authorId);
    return (
      book.title.toLowerCase().includes(lowerQuery) ||
      author?.name.toLowerCase().includes(lowerQuery)
    );
  });
}

export async function getCacheStats() {
  const db = await getDB();

  const [authorCount, bookCount, syncMeta] = await Promise.all([
    db.count("authors"),
    db.count("books"),
    db.get("metadata", "lastSync"),
  ]);

  return {
    authorCount,
    bookCount,
    lastSync: syncMeta?.value || null,
  };
}

export async function clearCache() {
  const db = await getDB();
  const tx = db.transaction(["authors", "books", "metadata"], "readwrite");

  await tx.objectStore("authors").clear();
  await tx.objectStore("books").clear();
  await tx.objectStore("metadata").clear();

  await tx.done;
}
