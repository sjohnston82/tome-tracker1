"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLibrary } from "@/lib/hooks/useLibrary";
import { AuthorCard } from "@/components/library/author-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function LibraryPage() {
  const router = useRouter();
  const { loading, error, authors, stats, sync } = useLibrary();
  const [search, setSearch] = useState("");
  const [groupBySeries, setGroupBySeries] = useState(false);

  const filteredAuthors = authors.filter(
    (author) =>
      author.name.toLowerCase().includes(search.toLowerCase()) ||
      author.books.some((book: any) =>
        book.title.toLowerCase().includes(search.toLowerCase())
      )
  );

  if (loading && !authors.length) {
    return <div className="text-center py-12">Loading...</div>;
  }
  if (error) {
    return <div className="text-center py-12 text-red-600">{error}</div>;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">My Library</h1>
          {stats && (
            <p className="text-gray-600">
              {stats.bookCount} books by {stats.authorCount} authors
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button onClick={() => router.push("/scan")} size="sm">
            📷 Scan
          </Button>
          <Button
            onClick={() => router.push("/library/add")}
            variant="secondary"
            size="sm"
          >
            ✏️ Add
          </Button>
        </div>
      </div>
      <Input
        type="search"
        placeholder="Search..."
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        className="mb-4"
      />
      <label className="flex items-center gap-2 mb-6 text-sm">
        <input
          type="checkbox"
          checked={groupBySeries}
          onChange={(event) => setGroupBySeries(event.target.checked)}
        />
        Group by series
      </label>
      {filteredAuthors.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          {search ? "No matches" : "Your library is empty"}
          {!search && (
            <Button onClick={() => router.push("/scan")} className="mt-4">
              Scan your first book
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredAuthors.map((author) => (
            <AuthorCard
              key={author.id}
              author={author}
              groupBySeries={groupBySeries}
            />
          ))}
        </div>
      )}
    </div>
  );
}
