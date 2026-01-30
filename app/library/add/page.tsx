"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface DuplicateMatch {
  id: string;
  title: string;
  author: string;
  score: number;
}

export default function ManualAddPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: "",
    authorName: "",
    isbn13: "",
    publisher: "",
    publicationYear: "",
    seriesName: "",
    seriesNumber: "",
    tags: "",
    genres: "",
  });
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);

  const handleChange = (field: string, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const checkDuplicates = async () => {
    if (!form.title || !form.authorName) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch("/api/books/check-duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, authorName: form.authorName }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || "Duplicate check failed");
        return;
      }
      setMatches(data.matches || []);
    } catch {
      setError("Network error");
    } finally {
      setChecking(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        title: form.title,
        authorName: form.authorName,
        isbn13: form.isbn13 || null,
        publisher: form.publisher || null,
        publicationYear: form.publicationYear
          ? parseInt(form.publicationYear, 10)
          : null,
        seriesName: form.seriesName || null,
        seriesNumber: form.seriesNumber ? parseFloat(form.seriesNumber) : null,
        tags: form.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        genres: form.genres
          .split(",")
          .map((genre) => genre.trim())
          .filter(Boolean),
        source: "MANUAL",
      };

      const response = await fetch("/api/books", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.error_code === "DUPLICATE_ISBN" && data.details?.existingBookId) {
          router.push(`/library/book/${data.details.existingBookId}`);
          return;
        }
        setError(data.message || "Failed to add book");
        return;
      }
      router.push(`/library/book/${data.book.id}`);
    } catch {
      setError("Network error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add a book</h1>
        <p className="text-gray-600">Enter details manually</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg text-sm">
            {error}
          </div>
        )}
        <Input
          label="Title"
          value={form.title}
          onChange={(event) => handleChange("title", event.target.value)}
          required
        />
        <Input
          label="Author"
          value={form.authorName}
          onChange={(event) => handleChange("authorName", event.target.value)}
          required
        />
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="ISBN-13"
            value={form.isbn13}
            onChange={(event) => handleChange("isbn13", event.target.value)}
          />
          <Input
            label="Publisher"
            value={form.publisher}
            onChange={(event) => handleChange("publisher", event.target.value)}
          />
          <Input
            label="Publication year"
            type="number"
            value={form.publicationYear}
            onChange={(event) => handleChange("publicationYear", event.target.value)}
          />
          <Input
            label="Series"
            value={form.seriesName}
            onChange={(event) => handleChange("seriesName", event.target.value)}
          />
          <Input
            label="Series #"
            type="number"
            value={form.seriesNumber}
            onChange={(event) => handleChange("seriesNumber", event.target.value)}
          />
        </div>
        <Input
          label="Tags (comma separated)"
          value={form.tags}
          onChange={(event) => handleChange("tags", event.target.value)}
        />
        <Input
          label="Genres (comma separated)"
          value={form.genres}
          onChange={(event) => handleChange("genres", event.target.value)}
        />
        <div className="flex gap-3">
          <Button
            type="button"
            variant="secondary"
            onClick={checkDuplicates}
            loading={checking}
          >
            Check duplicates
          </Button>
          <Button type="submit" loading={submitting}>
            Add book
          </Button>
        </div>
      </form>
      {matches.length > 0 && (
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg text-sm space-y-2">
          <p className="font-medium">Possible duplicates:</p>
          {matches.map((match) => (
            <button
              key={match.id}
              className="block text-left w-full hover:underline"
              onClick={() => router.push(`/library/book/${match.id}`)}
            >
              {match.title} — {match.author}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
