"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { BookCover } from './book-cover';
import { sortAuthorBooks, type BookOrder, type ShelfBook } from '@/lib/books/book-order';
import { usePreferences } from '@/lib/preferences';
import { useEdgeScroll } from '@/lib/hooks/useEdgeScroll';

type ShelfAuthor = { id: string; name: string; books: ShelfBook[] };
export function LetterShelf({ letter, authors, groupBySeries, bookSort = 'series' }: { letter: string; authors: ShelfAuthor[]; groupBySeries: boolean; bookSort?: BookOrder }) {
  const captionId = useId(), rowId = useId();
  const row = useRef<HTMLUListElement>(null);
  const { preferences } = usePreferences();
  const { move, stop } = useEdgeScroll(row);
  const books = useMemo(() => authors.flatMap(author => sortAuthorBooks(author.books, bookSort).map(book => ({ ...book, authorName: author.name }))), [authors, bookSort]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [keyboardId, setKeyboardId] = useState<string | null>(null);
  const focused = books.find(book => book.id === (hoveredId ?? keyboardId));
  useEffect(() => { stop(); }, [books, stop]);
  const [position, setPosition] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const update = () => setPosition({ previous: element.scrollLeft > 1, next: element.scrollLeft < element.scrollWidth - element.clientWidth - 1 });
    update(); element.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => { element.removeEventListener('scroll', update); window.removeEventListener('resize', update); observer?.disconnect(); };
  }, [books]);
  const scrollPage = (direction: number) => {
    const element = row.current;
    if (!element) return;
    stop();
    const reduced = preferences.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({ left: Math.max(0, Math.min(element.scrollWidth - element.clientWidth, element.scrollLeft + direction * element.clientWidth * 0.9)), behavior: reduced ? 'auto' : 'smooth' });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    const element = row.current;
    if (!element || event.target !== event.currentTarget) return;
    const step = Math.max(128, element.clientWidth * 0.8);
    let left: number;
    switch (event.key) { case 'ArrowLeft': left = element.scrollLeft - step; break; case 'ArrowRight': left = element.scrollLeft + step; break; case 'Home': left = 0; break; case 'End': left = element.scrollWidth - element.clientWidth; break; default: return; }
    event.preventDefault(); stop();
    const reduced = preferences.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({ left: Math.max(0, Math.min(element.scrollWidth - element.clientWidth, left)), behavior: reduced ? 'auto' : 'smooth' });
  };
  if (!books.length) return null;
  return <div className="min-w-0">
    <div className="relative">
    <ul id={rowId} ref={row} aria-label={`Books under ${letter}`} aria-describedby={captionId} tabIndex={0} onKeyDown={onKeyDown} onPointerMove={move} onPointerLeave={stop} onPointerDown={stop} onWheel={stop} className="book-carousel flex gap-4 sm:gap-5 overflow-x-auto overscroll-x-contain py-4 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-500">
      {books.map(book => <li key={book.id} data-book-id={book.id} className="relative shrink-0 w-28 sm:w-36 hover:z-10">
        <Link href={`/library/book/${book.id}`} aria-label={`${book.title} by ${book.authorName}`} onMouseEnter={() => setHoveredId(book.id)} onMouseLeave={() => setHoveredId(null)} onFocus={() => setKeyboardId(book.id)} onBlur={() => setKeyboardId(null)} className="book-carousel-card block rounded-lg transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500">
          <BookCover url={book.coverUrl ?? null} title={book.title} shelf />
        </Link>
      </li>)}
    </ul>
    {(position.previous || position.next) && <>
      <button type="button" aria-label={`Previous books under ${letter}`} aria-controls={rowId} disabled={!position.previous} onPointerDown={stop} onClick={() => scrollPage(-1)} className="absolute z-20 left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-600 shadow-sm disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true">←</span></button>
      <button type="button" aria-label={`Next books under ${letter}`} aria-controls={rowId} disabled={!position.next} onPointerDown={stop} onClick={() => scrollPage(1)} className="absolute z-20 right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-600 shadow-sm disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true">→</span></button>
    </>}
    </div>
    <div id={captionId} role="status" aria-label={`Focused book under ${letter}`} aria-live="polite" aria-atomic="true" className="min-h-28 pt-2 text-center space-y-1">
      {focused ? <>
        <h3 className="text-lg font-semibold leading-snug break-words">{focused.title}</h3>
        <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{focused.authorName}</p>
        {groupBySeries && focused.seriesName && <p className="text-xs text-gray-500 dark:text-gray-400">{focused.seriesName}{focused.seriesNumber != null ? ` #${focused.seriesNumber}` : ''}</p>}
      </> : <p className="text-xs text-gray-500 dark:text-gray-400">{books.length} {books.length === 1 ? 'book' : 'books'}</p>}
    </div>
  </div>;
}
