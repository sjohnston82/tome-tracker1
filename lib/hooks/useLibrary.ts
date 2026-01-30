"use client";

import { useState, useEffect, useCallback } from "react";

export function useLibrary() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authors, setAuthors] = useState<any[]>([]);
  const [stats, setStats] = useState<{ bookCount: number; authorCount: number } | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const sync = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/library/sync");
      if (!res.ok) throw new Error("Failed to sync");
      const data = await res.json();
      setAuthors(data.authors);
      setStats(data.stats);
      setLastSynced(data.syncedAt);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    sync();
  }, [sync]);

  return { loading, error, authors, stats, lastSynced, sync };
}
