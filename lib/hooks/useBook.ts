"use client";

import { useState, useEffect, useCallback } from "react";

export function useBook(id: string) {
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBook = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/books/${id}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? "Book not found" : "Failed to load");
      }
      const data = await res.json();
      setBook(data.book);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchBook();
  }, [fetchBook]);

  const updateBook = async (updates: any) => {
    const res = await fetch(`/api/books/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    setBook(data.book);
    return { success: true };
  };

  const deleteBook = async () => {
    const res = await fetch(`/api/books/${id}`, { method: "DELETE" });
    return { success: res.ok };
  };

  return { book, loading, error, updateBook, deleteBook, refresh: fetchBook };
}
