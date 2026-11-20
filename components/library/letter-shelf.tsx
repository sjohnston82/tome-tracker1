"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import Link from 'next/link';
import { BookCover } from './book-cover';
import { sortAuthorBooks, type BookOrder, type ShelfBook } from '@/lib/books/book-order';
import { usePreferences } from '@/lib/preferences';

type ShelfAuthor = { id: string; name: string; books: ShelfBook[] };
export function LetterShelf({ letter, authors, groupBySeries, bookSort = 'series' }: { letter: string; authors: ShelfAuthor[]; groupBySeries: boolean; bookSort?: BookOrder }) {
  const rowId = useId(), captionId = useId();
  const row = useRef<HTMLUListElement>(null);
  const scrollTarget = useRef<string | null>(null);
  const { preferences } = usePreferences();
  const books = useMemo(() => authors.flatMap(author => sortAuthorBooks(author.books, bookSort).map(book => ({ ...book, authorName: author.name }))), [authors, bookSort]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const focused = books.find(book => book.id === activeId) ?? books[0];
  const activeIndex = focused ? books.findIndex(book => book.id === focused.id) : -1;
  useEffect(() => {
    const element = row.current;
    if (!element) return;
    scrollTarget.current = null;
    const update = () => {
      const center = element.getBoundingClientRect().left + element.clientWidth / 2;
      let closest: string | null = null, distance = Infinity;
      for (const item of element.children) {
        const rect = item.getBoundingClientRect(), delta = Math.abs(rect.left + rect.width / 2 - center);
        if (delta < distance) { closest = item.getAttribute('data-book-id'); distance = delta; }
      }
      if (closest) {
        if (scrollTarget.current && closest !== scrollTarget.current) return;
        scrollTarget.current = null; setActiveId(closest);
      }
    };
    const settle = () => { scrollTarget.current = null; update(); };
    update(); element.addEventListener('scroll', update, { passive: true }); element.addEventListener('scrollend', settle); window.addEventListener('resize', settle);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(settle);
    observer?.observe(element);
    return () => { element.removeEventListener('scroll', update); element.removeEventListener('scrollend', settle); window.removeEventListener('resize', settle); observer?.disconnect(); };
  }, [books]);
  const select = (index: number) => {
    const book = books[index], element = row.current;
    if (!book || !element) return;
    scrollTarget.current = book.id; setActiveId(book.id);
    const item = element.children[index], rect = item.getBoundingClientRect();
    const left = element.scrollLeft + rect.left + rect.width / 2 - element.getBoundingClientRect().left - element.clientWidth / 2;
    const reduced = preferences.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    element.scrollTo({ left, behavior: reduced ? 'auto' : 'smooth' });
  };
  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.target !== event.currentTarget) return;
    let index: number;
    switch (event.key) { case 'ArrowLeft': index = Math.max(0, activeIndex - 1); break; case 'ArrowRight': index = Math.min(books.length - 1, activeIndex + 1); break; case 'Home': index = 0; break; case 'End': index = books.length - 1; break; default: return; }
    event.preventDefault(); select(index);
  };
  if (!focused) return null;
  return <div className="min-w-0">
    <div className="relative">
      <ul id={rowId} ref={row} aria-label={`Books under ${letter}`} aria-describedby={captionId} tabIndex={0} onKeyDown={onKeyDown} onPointerDown={() => { scrollTarget.current = null; }} onWheel={() => { scrollTarget.current = null; }} className="flex gap-4 sm:gap-5 overflow-x-auto overscroll-x-contain snap-x snap-mandatory [padding-inline:max(0px,calc(50%_-_3.5rem))] sm:[padding-inline:max(0px,calc(50%_-_4.5rem))] pt-2 pb-3 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-500">
        {books.map(book => <li key={book.id} data-book-id={book.id} className="shrink-0 w-28 sm:w-36 snap-center">
          <Link href={`/library/book/${book.id}`} aria-label={`${book.title} by ${book.authorName}`} aria-current={book.id === focused.id ? 'true' : undefined} onMouseEnter={() => { scrollTarget.current = null; setActiveId(book.id); }} onFocus={() => select(books.findIndex(item => item.id === book.id))} className={`block rounded-lg border-2 overflow-hidden transition-[opacity,border-color] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 ${book.id === focused.id ? 'border-blue-500 opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}>
            <BookCover url={book.coverUrl ?? null} title={book.title} shelf />
          </Link>
        </li>)}
      </ul>
      {books.length > 1 && <>
        <button type="button" aria-label={`Previous book under ${letter}`} aria-controls={rowId} disabled={activeIndex <= 0} onClick={() => select(activeIndex - 1)} className="absolute left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-600 disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true">←</span></button>
        <button type="button" aria-label={`Next book under ${letter}`} aria-controls={rowId} disabled={activeIndex === books.length - 1} onClick={() => select(activeIndex + 1)} className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-600 disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true">→</span></button>
      </>}
    </div>
    <div id={captionId} role="status" aria-label={`Focused book under ${letter}`} aria-live="polite" aria-atomic="true" className="min-h-28 pt-2 text-center space-y-1">
      <h3 className="text-lg font-semibold leading-snug break-words"><Link href={`/library/book/${focused.id}`} className="hover:text-blue-700 dark:hover:text-blue-300 focus-visible:outline-2 focus-visible:outline-blue-500">{focused.title}</Link></h3>
      <p className="text-sm text-gray-600 dark:text-gray-300 break-words">{focused.authorName}</p>
      {groupBySeries && focused.seriesName && <p className="text-xs text-gray-500 dark:text-gray-400">{focused.seriesName}{focused.seriesNumber != null ? ` #${focused.seriesNumber}` : ''}</p>}
      <p className="text-xs text-gray-500 dark:text-gray-400">{activeIndex + 1} of {books.length} {books.length === 1 ? 'book' : 'books'}</p>
    </div>
  </div>;
}
