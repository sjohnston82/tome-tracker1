"use client";
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { BookCover } from './book-cover';
import { CoverCarousel } from './cover-carousel';
import { sortAuthorBooks, type BookOrder, type ShelfBook } from '@/lib/books/book-order';
type ShelfAuthor = { id: string; name: string; books: ShelfBook[] };
export function LetterShelf({ letter, authors, groupBySeries, bookSort = 'series' }: { letter: string; authors: ShelfAuthor[]; groupBySeries: boolean; bookSort?: BookOrder }) {
  const books = useMemo(() => authors.flatMap(author => sortAuthorBooks(author.books, bookSort).map(book => ({ ...book, authorName: author.name }))), [authors, bookSort]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [keyboardId, setKeyboardId] = useState<string | null>(null);
  const focused = books.find(book => book.id === (hoveredId ?? keyboardId));
  if (!books.length) return null;
  return <CoverCarousel label={`Books under ${letter}`} captionLabel={`Focused book under ${letter}`} revision={books} tallCaption={groupBySeries} caption={focused ? <>
        <h3 className="text-lg font-semibold leading-snug break-words">{focused.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{focused.authorName}</p>
        {groupBySeries && focused.seriesName && <p className="text-xs text-gray-500 dark:text-gray-400">{focused.seriesName}{focused.seriesNumber != null ? ` #${focused.seriesNumber}` : ''}</p>}
      </> : <p className="text-xs text-gray-500 dark:text-gray-400">{books.length} {books.length === 1 ? 'book' : 'books'}</p>}>
      {books.map(book => <li key={book.id} data-book-id={book.id} className="relative shrink-0 w-28 sm:w-36 hover:z-10">
        <Link href={`/library/book/${book.id}`} aria-label={`${book.title} by ${book.authorName}`} onMouseEnter={() => setHoveredId(book.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setKeyboardId(book.id)} onBlur={() => setKeyboardId(null)} className="book-carousel-card block rounded-lg transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
          <BookCover url={book.coverUrl ?? null} title={book.title} shelf />
        </Link>
      </li>)}
  </CoverCarousel>;
}
