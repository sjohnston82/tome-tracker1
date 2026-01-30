"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface SearchResult {
  title: string;
  authors: string[];
  isbn13?: string;
  coverUrl?: string;
  publishedYear?: number;
}

export default function LibrarySearchPage() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/lookup/search?q=${encodeURIComponent(query.trim())}`
      );
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Search failed");
        return;
      }
      setResults(data.results || []);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (result: SearchResult) => {
    const key = result.isbn13 || result.title;
    setAddingId(key);
    setError(null);
    try {
      const payload = {
        title: result.title,
        authorName: result.authors?.[0] || "Unknown",
        isbn13: result.isbn13 || null,
        publicationYear: result.publishedYear || null,
        coverUrl: result.coverUrl || null,
        tags: [],
        genres: [],
        source: "MANUAL",
      };

      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (response.ok) {
        router.push(`/library/book/${data.book.id}`);
        return;
      }
      if (data.error_code === "DUPLICATE_ISBN" && data.details?.existingBookId) {
        router.push(`/library/book/${data.details.existingBookId}`);
        return;
      }
      setError(data.message || "Failed to add book");
    } catch {
      setError("Network error");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Search online</h1>
        <p className="text-gray-600">Find a book and add it to your library</p>
      </div>
      <form onSubmit={handleSearch} className="flex gap-3">
        <Input
          type="search"
          placeholder="Search by title, author, ISBN..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" loading={loading}>
          Search
        </Button>
      </form>
      {error && (
        <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
          {error}
        </div>
      )}
      {results.length === 0 && !loading ? (
        <div className="text-gray-500 text-sm">No results yet.</div>
      ) : (
        <div className="space-y-4">
          {results.map((result) => {
            const key = result.isbn13 || result.title;
            return (
              <div
                key={key}
                className="bg-white dark:bg-gray-800 rounded-lg p-4 flex gap-4 items-center"
              >
                {result.coverUrl ? (
                  <img
                    src={result.coverUrl}
                    alt={result.title}
                    className="w-16 h-24 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-24 bg-gray-200 rounded flex items-center justify-center">
                    📖
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-medium">{result.title}</h3>
                  <p className="text-sm text-gray-600">
                    {result.authors?.join(", ") || "Unknown author"}
                  </p>
                  {result.publishedYear && (
                    <p className="text-xs text-gray-500">{result.publishedYear}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleAdd(result)}
                  loading={addingId === key}
                >
                  Add
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
