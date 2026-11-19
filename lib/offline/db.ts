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
      coverLocked?: boolean;
      seriesName: string | null;
      seriesNumber: number | null;
      readingStatus?: 'UNKNOWN' | 'UNREAD' | 'READING' | 'READ';
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
let generation = 0;
export const cacheRevision = () => generation;

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
    }).catch(error => { dbPromise = null; throw error; });
  }
  return dbPromise;
}

export async function cacheLibraryData(
  authors: LibraryDB["authors"]["value"][],
  books: LibraryDB["books"]["value"][],
  userId: string,
  revision = generation
) {
  const db = await getDB();
  if (revision !== generation) return false;
  const tx = db.transaction(["authors", "books", "metadata"], "readwrite");
  try {
    await tx.objectStore("authors").clear();
    await tx.objectStore("books").clear();

    for (const author of authors) {
      await tx.objectStore("authors").put(author);
    }

    for (const book of books) {
      await tx.objectStore("books").put(book);
    }

    const now = new Date().toISOString();
    await tx.objectStore('metadata').put({ key: 'owner', value: userId, updatedAt: now });
    await tx.objectStore("metadata").put({
      key: "lastSync",
      value: now,
      updatedAt: now,
    });

    await tx.done;
    return true;
  } catch (error) {
    try { tx.abort(); } catch { /* It may already have aborted. */ }
    await tx.done.catch(() => {});
    throw error;
  }
}

export async function getCachedLibrary(userId: string | null = null) {
  const db = await getDB();
  const tx = db.transaction(['authors', 'books', 'metadata'], 'readonly');
  const [authors, books, syncMeta, owner] = await Promise.all([
    tx.objectStore('authors').getAll(),
    tx.objectStore('books').getAll(),
    tx.objectStore('metadata').get('lastSync'),
    tx.objectStore('metadata').get('owner'),
  ]);
  await tx.done;
  if (!userId || owner?.value !== userId) return { authors: [], books: [], lastSync: null };

  return {
    authors,
    books,
    lastSync: syncMeta?.value || null,
  };
}

export async function checkOwnershipOffline(isbn13: string, userId: string | null = null): Promise<boolean> {
  return (await getCachedLibrary(userId)).books.some(book => book.isbn13 === isbn13);
}

export async function searchBooksOffline(query: string, userId: string | null = null) {
  const { books, authors } = await getCachedLibrary(userId);

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

export async function getCacheStats(userId: string | null = null) {
  const db = await getDB();

  const tx = db.transaction(['authors', 'books', 'metadata'], 'readonly');
  const [authorCount, bookCount, syncMeta, owner] = await Promise.all([
    tx.objectStore('authors').count(),
    tx.objectStore('books').count(),
    tx.objectStore('metadata').get('lastSync'),
    tx.objectStore('metadata').get('owner'),
  ]);
  await tx.done;
  if (!userId || owner?.value !== userId) return { authorCount: 0, bookCount: 0, lastSync: null };

  return {
    authorCount,
    bookCount,
    lastSync: syncMeta?.value || null,
  };
}

export async function clearCache() {
  generation++;
  const db = await getDB();
  const tx = db.transaction(["authors", "books", "metadata"], "readwrite");

  await tx.objectStore("authors").clear();
  await tx.objectStore("books").clear();
  await tx.objectStore("metadata").clear();

  await tx.done;
  if (typeof caches !== 'undefined') await Promise.all(['library-sync', 'cover-images', 'google-covers'].map(name => caches.delete(name)));
}
