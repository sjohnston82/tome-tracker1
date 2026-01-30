"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AuthorCard({
  author,
  groupBySeries,
}: {
  author: any;
  groupBySeries: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
            👤
          </div>
          <div className="text-left">
            <h3 className="font-medium">{author.name}</h3>
            <p className="text-sm text-gray-500">{author.books.length} books</p>
          </div>
        </div>
        <span
          className={cn("transition-transform text-gray-400", expanded && "rotate-180")}
        >
          ▼
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-700 space-y-2 mt-3">
          {author.books.map((book: any) => (
            <Link
              key={book.id}
              href={`/library/book/${book.id}`}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700/50"
            >
              {book.coverUrl ? (
                <img
                  src={book.coverUrl}
                  alt={book.title}
                  className="w-10 h-14 object-cover rounded"
                />
              ) : (
                <div className="w-10 h-14 bg-gray-200 rounded flex items-center justify-center">
                  📖
                </div>
              )}
              <div>
                <p className="font-medium">{book.title}</p>
                {groupBySeries && book.seriesName && (
                  <p className="text-sm text-gray-500">
                    {book.seriesName} #{book.seriesNumber}
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
