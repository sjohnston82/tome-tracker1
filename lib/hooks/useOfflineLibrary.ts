"use client";

import { useState, useEffect, useCallback } from "react";
import {
  getCachedLibrary,
  cacheLibraryData,
  searchBooksOffline,
  getCacheStats,
  clearCache,
} from "@/lib/offline/db";

export function useOfflineLibrary() {
  const [isOnline, setIsOnline] = useState(true);
  const [cacheStats, setCacheStats] = useState<{
    bookCount: number;
    authorCount: number;
    lastSync: string | null;
  } | null>(null);

  useEffect(() => {
    setIsOnline(navigator.onLine);

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    getCacheStats().then(setCacheStats).catch(() => {});
  }, []);

  const syncAndCache = useCallback(async () => {
    if (!navigator.onLine) return false;

    try {
      const response = await fetch("/api/library/sync");
      if (!response.ok) return false;

      const data = await response.json();

      const authors = data.authors.map((author: any) => ({
        id: author.id,
        name: author.name,
        bio: author.bio,
        photoUrl: author.photoUrl,
      }));

      const books = data.authors.flatMap((author: any) =>
        author.books.map((book: any) => ({
          id: book.id,
          authorId: author.id,
          title: book.title,
          isbn13: book.isbn13,
          coverUrl: book.coverUrl,
          seriesName: book.seriesName,
          seriesNumber: book.seriesNumber,
        }))
      );

      await cacheLibraryData(authors, books);
      setCacheStats(await getCacheStats());

      return true;
    } catch {
      return false;
    }
  }, []);

  const searchOffline = useCallback(async (query: string) => {
    return searchBooksOffline(query);
  }, []);

  const getCached = useCallback(async () => {
    return getCachedLibrary();
  }, []);

  const clearLocalCache = useCallback(async () => {
    await clearCache();
    setCacheStats(await getCacheStats());
  }, []);

  return {
    isOnline,
    cacheStats,
    syncAndCache,
    searchOffline,
    getCached,
    clearLocalCache,
  };
}
