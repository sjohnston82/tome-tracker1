'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePreferences } from "@/lib/preferences"
import { AuthorShelf } from './author-shelf'
import { AuthorCard } from './author-card'
import { AUTHOR_ALPHABET, groupAuthors } from '@/lib/books/author-groups'

type Author = { id: string; name: string; books: { id: string; title: string; coverUrl?: string | null; seriesName?: string | null; publicationYear?: number | null; seriesNumber?: number | null }[] }

export function AlphabeticalAuthors({ authors, groupBySeries, defaultExpanded = false, bookSort = "series", view = "list" }: { authors: Author[]; groupBySeries: boolean; view?: "list" | "shelves"; defaultExpanded?: boolean; bookSort?: "title" | "series" | "year" }) {
  const { preferences } = usePreferences()
  const groups = useMemo(() => groupAuthors(authors), [authors])
  const [active, setActive] = useState('')
  const root = useRef<HTMLDivElement>(null)
  const headings = useRef(new Map<string, HTMLHeadingElement>())

  useEffect(() => {
    let frame: number | null = null
    const update = () => {
      frame = null
      let current = groups[0]?.letter ?? ''
      for (const { letter } of groups) {
        if ((headings.current.get(letter)?.getBoundingClientRect().top ?? Infinity) <= 96) current = letter
      }
      if (window.scrollY > 0 && window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2) current = groups.at(-1)?.letter ?? current
      setActive(current)
    }
    const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update) }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    // Opening author cards changes section positions without necessarily scrolling.
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    if (root.current) observer?.observe(root.current)
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); observer?.disconnect(); if (frame !== null) window.cancelAnimationFrame(frame) }
  }, [groups])

  const jump = (letter: string) => {
    const heading = headings.current.get(letter)
    if (!heading) return
    const reduceMotion = preferences.reduceMotion || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    heading.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    heading.focus({ preventScroll: true })
    setActive(letter)
  }

  return <div ref={root} className="grid grid-cols-[minmax(0,1fr)_2.5rem] gap-3 sm:gap-6 items-start">
    <div className="min-w-0 space-y-8">
      {groups.map(group => <section key={group.letter} aria-labelledby={`authors-${group.letter === '#' ? 'other' : group.letter}`}>
        <h2 id={`authors-${group.letter === '#' ? 'other' : group.letter}`} ref={element => { if (element) headings.current.set(group.letter, element); else headings.current.delete(group.letter) }} tabIndex={-1} className="scroll-mt-24 mb-3 flex items-baseline gap-3 border-b border-gray-200 dark:border-gray-700 pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-sm">
          <span className="text-2xl font-bold">{group.letter}</span>{' '}<span className="text-sm text-gray-500">{group.authors.length} {group.authors.length === 1 ? 'author' : 'authors'}</span>
        </h2>
        <div className={view === "shelves" ? "space-y-7" : "space-y-3"}>{group.authors.map(author => view === "shelves" ? <AuthorShelf key={author.id} author={author} groupBySeries={groupBySeries} bookSort={bookSort} /> : <AuthorCard key={author.id} author={author} groupBySeries={groupBySeries} defaultExpanded={defaultExpanded} bookSort={bookSort} />)}</div>
      </section>)}
    </div>
    <nav aria-label="Author alphabet" className="sticky top-20 max-h-[calc(100dvh-11rem)] overflow-y-auto rounded-full border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/95 py-2 shadow-sm">
      {AUTHOR_ALPHABET.map(letter => {
        const available = groups.some(group => group.letter === letter)
        return <button key={letter} type="button" disabled={!available} aria-label={`Jump to ${letter === '#' ? 'other authors' : letter}`} aria-current={available && active === letter ? 'location' : undefined} onClick={() => jump(letter)} className={`block w-full min-h-6 text-xs leading-6 font-semibold rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500 disabled:text-gray-300 dark:disabled:text-gray-700 ${active === letter && available ? 'bg-blue-600 text-white' : 'text-gray-600 dark:text-gray-300 enabled:hover:bg-blue-50 dark:enabled:hover:bg-blue-950'}`}>{letter}</button>
      })}
    </nav>
  </div>
}
