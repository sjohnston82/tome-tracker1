"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { usePreferences } from '@/lib/preferences';
import { useEdgeScroll } from '@/lib/hooks/useEdgeScroll';
export function CoverCarousel({ label, captionLabel, caption, children, revision, tallCaption = false }: { label: string; captionLabel: string; caption: ReactNode; children: ReactNode; revision: unknown; tallCaption?: boolean }) {
  const captionId = useId(), rowId = useId();
  const row = useRef<HTMLUListElement>(null);
  const { preferences } = usePreferences();
  const { move, stop } = useEdgeScroll(row);
  useEffect(() => { stop(); }, [revision, stop]);
  const [position, setPosition] = useState({ previous: false, next: false });
  useEffect(() => {
    const element = row.current;
    if (!element) return;
    const update = () => setPosition({ previous: element.scrollLeft > 1, next: element.scrollLeft < element.scrollWidth - element.clientWidth - 1 });
    update(); element.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(element);
    return () => { element.removeEventListener('scroll', update); window.removeEventListener('resize', update); observer?.disconnect(); };
  }, [revision]);
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
  const lowerLabel = label.charAt(0).toLowerCase() + label.slice(1);
  return <div className="min-w-0"><div className="relative">
    <ul id={rowId} ref={row} aria-label={label} aria-describedby={captionId} tabIndex={0} onKeyDown={onKeyDown} onPointerMove={move} onPointerLeave={stop} onPointerDown={stop} onWheel={stop} className="book-carousel flex gap-4 sm:gap-5 overflow-x-auto overscroll-x-contain py-4 rounded-lg focus-visible:outline-2 focus-visible:outline-blue-500">{children}</ul>
    {(position.previous || position.next) && <>
      <button type="button" aria-label={`Previous ${lowerLabel}`} aria-controls={rowId} disabled={!position.previous} onPointerDown={stop} onClick={() => scrollPage(-1)} className="absolute z-20 left-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-600 shadow-sm disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true">←</span></button>
      <button type="button" aria-label={`Next ${lowerLabel}`} aria-controls={rowId} disabled={!position.next} onPointerDown={stop} onClick={() => scrollPage(1)} className="absolute z-20 right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 dark:bg-gray-900/95 border border-gray-300 dark:border-gray-600 shadow-sm disabled:opacity-25 focus-visible:outline-2 focus-visible:outline-blue-500"><span aria-hidden="true">→</span></button>
    </>}
  </div><div id={captionId} role="status" aria-label={captionLabel} aria-live="polite" aria-atomic="true" className={`${tallCaption ? 'min-h-20' : 'min-h-16'} pt-1 text-center space-y-1`}>{caption}</div></div>;
}
