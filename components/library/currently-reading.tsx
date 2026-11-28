'use client'

import Link from 'next/link'
import { BookCover } from './book-cover'
import { ReadingTracker } from './reading-tracker'

type Book = { id: string; title: string; readingStatus?: string; coverUrl?: string | null }
export function CurrentlyReading({ authors, onChanged }: { authors: { name: string; books: Book[] }[]; onChanged: () => Promise<void> }) {
  const current = authors.flatMap(author => author.books.filter(book => book.readingStatus === 'READING').map(book => ({ ...book, author: author.name })))
  return <section aria-labelledby="currently-reading-title" className="mb-6 space-y-3">
    <h2 id="currently-reading-title" className="text-xl font-semibold">Currently reading</h2>
    {!current.length && <p className="text-sm text-gray-500">Open an unread book and choose Start reading to begin a reading log.</p>}
    {current.map(book => <article key={book.id} className="border border-blue-200 dark:border-blue-900 rounded-xl p-4 bg-blue-50/40 dark:bg-blue-950/20 space-y-4"><div className="flex gap-3 items-start"><BookCover url={book.coverUrl ?? null} title={book.title} thumbnail /><div className="min-w-0"><Link className="font-semibold text-lg text-blue-700 dark:text-blue-300 hover:underline" href={`/library/book/${book.id}`}>{book.title}</Link><p className="text-sm text-gray-500">{book.author}</p></div></div><ReadingTracker bookId={book.id} status="READING" onChanged={onChanged} /></article>)}
  </section>
}
