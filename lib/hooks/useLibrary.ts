"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useOfflineLibrary } from "@/lib/hooks/useOfflineLibrary";
import { useCacheOwner } from '@/lib/offline/owner';

export function useLibrary() {
  const userId = useCacheOwner();
  const owner = useRef(userId);
  owner.current = userId;
  const { isOnline, getCached, syncAndCache } = useOfflineLibrary();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authors, setAuthors] = useState<any[]>([]);
  const [stats, setStats] = useState<{ bookCount: number; authorCount: number } | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);
  const [isFromCache, setIsFromCache] = useState(false);

  const sync = useCallback(async () => {
    setLoading(true);
    setError(null);

    if (isOnline && userId) {
      try {
        const res = await fetch("/api/library/sync", { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (owner.current !== userId) return;
          if (data.userId !== userId) throw new Error('Cached library belongs to another account');
          setAuthors(data.authors);
          setStats(data.stats);
          setLastSynced(data.syncedAt);
          setIsFromCache(false);

          await syncAndCache();

          setLoading(false);
          return;
        }
      } catch {
        // Fall through to cache
      }
    }

    try {
      const cached = await getCached();
      if (owner.current !== userId) return;

      if (cached.books.length > 0) {
        const authorMap = new Map<string, any>();

        for (const author of cached.authors) {
          authorMap.set(author.id, { ...author, books: [] });
        }

        for (const book of cached.books) {
          const author = authorMap.get(book.authorId);
          if (author) {
            author.books.push(book);
          }
        }

        setAuthors(Array.from(authorMap.values()).filter((author) => author.books.length > 0));
        setStats({ bookCount: cached.books.length, authorCount: authorMap.size });
        setLastSynced(cached.lastSync);
        setIsFromCache(true);
      } else {
        setError(isOnline ? "Failed to load library" : "No cached data available");
      }
    } catch {
      setError("Failed to load library");
    }

    setLoading(false);
  }, [getCached, isOnline, syncAndCache, userId]);

  useEffect(() => { setAuthors([]); setStats(null); setLastSynced(null); }, [userId]);

  useEffect(() => {
    sync();
  }, [sync]);

  return { loading, error, authors, stats, lastSynced, isFromCache, sync };
}
