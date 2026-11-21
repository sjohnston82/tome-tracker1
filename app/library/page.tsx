"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLibrary } from "@/lib/hooks/useLibrary";
import { CoverEnrichment } from "@/components/library/cover-enrichment";
import { AlphabeticalAuthors } from "@/components/library/alphabetical-authors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";
import { CurrentlyReading } from '@/components/library/currently-reading';

import { usePreferences } from "@/lib/preferences";

export default function LibraryPage() {
  const { preferences, ready, update, error: preferenceError } = usePreferences();
  const router = useRouter();
  const { loading, error, authors, stats, sync, isFromCache, lastSynced } = useLibrary();
  const [search, setSearch] = useState("");
  const [seriesOverride, setSeriesOverride] = useState<boolean | null>(null);
  const groupBySeries = seriesOverride ?? preferences.groupBySeries;
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
      <CoverEnrichment authors={authors} onUpdated={sync} enabled={ready && preferences.autoCovers} />
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
        <Link href="/library/review" className="text-sm text-blue-600 mt-2 mr-5 inline-block hover:underline">Review metadata →</Link>
        <Link href="/activity" className="text-sm text-blue-600 mt-2 mr-5 inline-block hover:underline">View reading activity →</Link>
        <button onClick={() => router.push('/series')} className="text-sm text-blue-600 mt-2 hover:underline">Explore series and missing books →</button>
      </section>
      {preferences.showCurrentlyReading && <CurrentlyReading authors={authors} onChanged={sync} />}
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
      <div role="group" aria-label="Library view" className="inline-flex p-1 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        {([{ value: 'list', label: 'Author list' }, { value: 'shelves', label: 'Book shelves' }] as const).map(view => <button key={view.value} type="button" disabled={!ready} aria-pressed={preferences.libraryView === view.value} onClick={() => update({ libraryView: view.value })} className={`px-3 py-2 text-sm rounded-md font-medium focus-visible:outline-2 focus-visible:outline-blue-500 disabled:opacity-50 ${preferences.libraryView === view.value ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'}`}>{view.label}</button>)}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={groupBySeries}
          onChange={(event) => setSeriesOverride(event.target.checked)}
        />
        Show series details
      </label>
      </div>
      {preferences.libraryView === "shelves" && <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Hover over a cover to enlarge it and see its title and author. Move the mouse near either edge to scroll, or use the arrow buttons to move faster. You can also swipe, or focus a row and use the arrow keys.</p>}
      {preferenceError && <p role="status" className="text-sm text-amber-700 mb-4">{preferenceError}</p>}
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
        <AlphabeticalAuthors key={`${ready}:${preferences.expandAuthors}`} authors={filteredAuthors} groupBySeries={groupBySeries} defaultExpanded={preferences.expandAuthors} bookSort={preferences.bookSort} view={preferences.libraryView} />
      )}
      </div>
    </>
  );
}
