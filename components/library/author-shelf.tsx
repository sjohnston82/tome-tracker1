"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { BookCover } from './book-cover';
import { sortAuthorBooks, type BookOrder, type ShelfBook } from '@/lib/books/book-order';
import { usePreferences } from '@/lib/preferences';

export function AuthorShelf({ author, groupBySeries, bookSort = 'series' }: { author: { id: string; name: string; books: ShelfBook[] }; groupBySeries: boolean; bookSort?: BookOrder }) {
  const titleId = useId(), rowId = useId();
  const row = useRef<HTMLUListElement>(null);
  const { preferences } = usePreferences();
  const books = useMemo(() => sortAuthorBooks(author.books, bookSort), [author.books, bookSort]);
  const [position, setPosition] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const update = () => setPosition({ previous: element.scrollLeft > 2, next: element.scrollLeft < element.scrollWidth - element.clientWidth - 2 });
    update();
    element.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => { element.removeEventListener('scroll', update); window.removeEventListener('resize', update); observer?.disconnect(); };
  }, [books]);
  const scroll = (direction: 'previous' | 'next' | 'start' | 'end') => {
    const element = row.current;
    if (!element) return;
    const reduced = preferences.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior = reduced ? 'auto' : 'smooth';
    if (direction === 'start' || direction === 'end') element.scrollTo({ left: direction === 'start' ? 0 : element.scrollWidth, behavior });
    else element.scrollBy({ left: Math.max(128, element.clientWidth * 0.85) * (direction === 'previous' ? -1 : 1), behavior });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.target !== event.currentTarget) return;
    const direction = { ArrowLeft: 'previous', ArrowRight: 'next', Home: 'start', End: 'end' }[event.key] as 'previous' | 'next' | 'start' | 'end' | undefined;
    if (direction) { event.preventDefault(); scroll(direction); }
  };
  return <section aria-labelledby={titleId} className="min-w-0 py-2">
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="min-w-0"><h3 id={titleId} className="text-lg sm:text-xl font-semibold break-words">{author.name}</h3><p className="text-sm text-gray-500 dark:text-gray-400">{books.length} {books.length === 1 ? 'book' : 'books'}</p></div>
      {(position.previous || position.next) && <div className="flex shrink-0 gap-2">
        <button type="button" aria-label={`Previous books by ${author.name}`} aria-controls={rowId} disabled={!position.previous} onClick={() => scroll('previous')} className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true">←</span></button>
        <button type="button" aria-label={`Next books by ${author.name}`} aria-controls={rowId} disabled={!position.next} onClick={() => scroll('next')} className="w-10 h-10 rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true">→</span></button>
      </div>}
    </div>
    <ul id={rowId} ref={row} aria-label={`Books by ${author.name}`} tabIndex={0} onKeyDown={onKeyDown} className="flex gap-4 sm:gap-5 overflow-x-auto overscroll-x-contain snap-x snap-proximity scroll-px-1 px-1 pt-1 pb-4 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-500">
      {books.map(book => <li key={book.id} className="shrink-0 w-28 sm:w-36 snap-start">
        <Link href={`/library/book/${book.id}`} className="group block rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
          <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 group-hover:border-blue-400 transition-colors"><BookCover url={book.coverUrl ?? null} title={book.title} shelf /></div>
          <p className="mt-3 text-sm font-semibold leading-snug break-words group-hover:text-blue-700 dark:group-hover:text-blue-300">{book.title}</p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-words">{author.name}</p>
          {groupBySeries && book.seriesName && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 break-words">{book.seriesName}{book.seriesNumber != null ? ` #${book.seriesNumber}` : ''}</p>}
        </Link>
      </li>)}
    </ul>
  </section>;
}
