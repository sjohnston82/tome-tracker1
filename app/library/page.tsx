"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLibrary } from "@/lib/hooks/useLibrary";
import { AuthorCard } from "@/components/library/author-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";

export default function LibraryPage() {
  const router = useRouter();
  const { loading, error, authors, stats, sync, isFromCache, lastSynced } = useLibrary();
  const [search, setSearch] = useState("");
  const [groupBySeries, setGroupBySeries] = useState(false);
  const reading = authors.flatMap(author => author.books).reduce((counts, book) => {
    const status = book.readingStatus || 'UNKNOWN';
    if (status in counts) counts[status as keyof typeof counts]++;
    return counts;
  }, { READ: 0, UNREAD: 0, READING: 0, UNKNOWN: 0 });

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
    <>
      <OnboardingModal />
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
      <section aria-label="Reading progress" className="border rounded-xl p-4 mb-5 bg-white dark:bg-gray-900">
        <div className="flex flex-wrap justify-between gap-2 text-sm mb-3"><strong>{reading.READ} of {stats?.bookCount ?? 0} books read</strong><span>{reading.READING} currently reading · {reading.UNREAD} unread · {reading.UNKNOWN} unknown</span></div>
        <progress aria-label="Owned books read" value={reading.READ} max={stats?.bookCount || 1} className="w-full h-2 accent-blue-600" />
        <button onClick={() => router.push('/series')} className="text-sm text-blue-600 mt-2 hover:underline">Explore series and missing books →</button>
      </section>
      {isFromCache && (
        <div className="bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-4 py-2 rounded-lg text-sm mb-4">
          📴 Viewing cached data from{" "}
          {lastSynced ? new Date(lastSynced).toLocaleString() : "earlier"}
        </div>
      )}
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
    </>
  );
}
