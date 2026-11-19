"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getCachedLibrary,
  cacheLibraryData,
  searchBooksOffline,
  getCacheStats,
  clearCache,
  cacheRevision,
} from "@/lib/offline/db";
import { useCacheOwner } from '@/lib/offline/owner';

export function useOfflineLibrary() {
  const userId = useCacheOwner();
  const owner = useRef(userId);
  owner.current = userId;
  const [isOnline, setIsOnline] = useState(true);
  const [cacheError, setCacheError] = useState<string | null>(null);
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
    let active = true;
    getCacheStats(userId).then(stats => { if (active) { setCacheStats(stats); setCacheError(null); } }).catch(() => { if (active) { setCacheStats(null); setCacheError('Offline storage is unavailable in this browser. Check site-storage permissions and try again.'); } });
    return () => { active = false; };
  }, [userId]);

  const syncAndCache = useCallback(async () => {
    if (!navigator.onLine || !userId) return false;
    const revision = cacheRevision();

    try {
      const response = await fetch("/api/library/sync", { cache: 'no-store' });
      if (!response.ok) return false;

      const data = await response.json();
      if (data.userId !== userId || owner.current !== userId) return false;

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
          coverLocked: book.coverLocked,
          seriesName: book.seriesName,
          seriesNumber: book.seriesNumber,
          readingStatus: book.readingStatus ?? 'UNKNOWN',
        }))
      );

      if (!await cacheLibraryData(authors, books, userId, revision)) return false;
      setCacheStats(await getCacheStats(userId));
      setCacheError(null);

      return true;
    } catch {
      return false;
    }
  }, [userId]);

  const searchOffline = useCallback(async (query: string) => {
    return searchBooksOffline(query, userId);
  }, [userId]);

  const getCached = useCallback(async () => {
    return getCachedLibrary(userId);
  }, [userId]);

  const clearLocalCache = useCallback(async () => {
    try { await clearCache(); }
    finally {
      try { setCacheStats(await getCacheStats(userId)); setCacheError(null); }
      catch { setCacheStats(null); setCacheError('Offline storage is unavailable in this browser.'); }
    }
  }, [userId]);

  return {
    isOnline,
    cacheStats,
    cacheError,
    syncAndCache,
    searchOffline,
    getCached,
    clearLocalCache,
  };
}
