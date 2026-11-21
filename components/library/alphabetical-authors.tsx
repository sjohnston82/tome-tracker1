'use client'
import { useMemo } from 'react'
import { LetterShelf } from './letter-shelf'
import { AuthorCard } from './author-card'
import { AlphabeticalSections } from './alphabetical-sections'
import { groupAuthors } from '@/lib/books/author-groups'
type Author = { id: string; name: string; books: { id: string; title: string; coverUrl?: string | null; seriesName?: string | null; publicationYear?: number | null; seriesNumber?: number | null }[] }
export function AlphabeticalAuthors({ authors, groupBySeries, defaultExpanded = false, bookSort = 'series', view = 'list' }: { authors: Author[]; groupBySeries: boolean; view?: 'list' | 'shelves'; defaultExpanded?: boolean; bookSort?: 'title' | 'series' | 'year' }) {
  const groups = useMemo(() => groupAuthors(authors), [authors])
  return <AlphabeticalSections groups={groups}>{(group, letter) => view === 'shelves'
    ? <LetterShelf letter={letter} authors={group} groupBySeries={groupBySeries} bookSort={bookSort} />
    : <div className="space-y-3">{group.map(author => <AuthorCard key={author.id} author={author} groupBySeries={groupBySeries} defaultExpanded={defaultExpanded} bookSort={bookSort} />)}</div>}
  </AlphabeticalSections>
}
