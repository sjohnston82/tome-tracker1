"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BookCover } from '@/components/library/book-cover';

export function AuthorCard({
  author,
  groupBySeries, defaultExpanded = false, bookSort = "series",
}: {
  author: any;
  groupBySeries: boolean; defaultExpanded?: boolean; bookSort?: "title" | "series" | "year";
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [opened, setOpened] = useState(defaultExpanded);
  const panelId = useId();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => { setOpened(true); setExpanded(!expanded); }}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div className="flex items-center gap-3">
          <div className="text-left">
            <h3 className="text-lg sm:text-xl font-semibold">{author.name}</h3>
            <p className="text-sm text-gray-500">{author.books.length} books</p>
          </div>
        </div>
        <span
          className={cn("transition-transform text-gray-400", expanded && "rotate-180")}
        >
          ▼
        </span>
      </button>
      {opened && (
        <div id={panelId} hidden={!expanded} className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 space-y-2 mt-3">
          {[...author.books].sort((a: any, b: any) => {
            if (bookSort === "year") return (a.publicationYear ?? Infinity) - (b.publicationYear ?? Infinity) || a.title.localeCompare(b.title);
            if (bookSort === "series") return (a.seriesName ?? "\uffff").localeCompare(b.seriesName ?? "\uffff") || (a.seriesNumber ?? Infinity) - (b.seriesNumber ?? Infinity) || a.title.localeCompare(b.title);
            return a.title.localeCompare(b.title);
          }).map((book: any) => (
            <Link
              key={book.id}
              href={`/library/book/${book.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              <BookCover url={book.coverUrl} title={book.title} thumbnail />
              <div>
                <p className="font-medium">{book.title}</p>
                {groupBySeries && book.seriesName && (
                  <p className="text-sm text-gray-500">
                    {book.seriesName}{book.seriesNumber != null ? ` #${book.seriesNumber}` : ''}
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
