"use client";
import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlphabeticalSections } from '@/components/library/alphabetical-sections';
import { CoverCarousel } from '@/components/library/cover-carousel';
import { ReferenceCover } from './reference-cover';
import { checklistStats, type ChecklistSeries } from '@/lib/series/checklist';
import { groupSeriesByAuthor, orderedSeriesEntries, seriesEntryArtwork } from '@/lib/series/shelves';

function SeriesShelf({ series, selected, onSelect, children }: { series: ChecklistSeries; selected: boolean; onSelect: () => void; children: ReactNode }) {
  const entries = useMemo(() => orderedSeriesEntries(series.entries), [series.entries]);
  const [hovered, setHovered] = useState<string | null>(null), [keyboard, setKeyboard] = useState<string | null>(null);
  const focused = entries.find(entry => entry.id === (hovered ?? keyboard));
  const summary = checklistStats(series);
  const focusedArt = focused ? seriesEntryArtwork(focused) : null;
  return <article aria-label={`${series.name} shelf`} className="min-w-0">
    <button type="button" onClick={onSelect} aria-expanded={selected} aria-controls={`series-details-${series.id}`} className="w-full text-left rounded-lg py-2 focus-visible:outline-2 focus-visible:outline-blue-500">
      <span className="flex flex-wrap items-baseline justify-between gap-2"><span className="font-semibold text-lg">{series.name}</span><span className="text-xs text-blue-600 dark:text-blue-400">{selected ? 'Close checklist' : 'Manage checklist'}</span></span>
      <span className="text-xs text-gray-500">{summary.owned} of {summary.total} owned · {summary.missing} missing</span>
    </button>
    <CoverCarousel label={`Books in ${series.name}`} captionLabel={`Focused book in ${series.name}`} revision={entries} caption={focused ? <><h4 className="font-semibold">{focused.work.title}</h4><p className="text-sm text-gray-500">{focused.work.authorName} · {focused.position == null ? 'Position unknown' : `#${focused.position}`} · {focusedArt?.editions.length ? `Owned${focusedArt.editions.some(book => book.title !== focused.work.title) ? ` in ${focusedArt.editions.map(book => book.title).join(' / ')}` : ''}` : 'Missing'}</p></> : <p className="text-xs text-gray-500">{summary.total} recorded entries · Missing books are grayed out</p>}>
      {entries.map(entry => {
        const artwork = seriesEntryArtwork(entry), owned = artwork.editions.length > 0;
        const content = <><div className={owned ? '' : 'grayscale opacity-45'} data-ownership={owned ? 'owned' : 'missing'}><ReferenceCover workId={entry.work.id} title={entry.work.title} author={entry.work.authorName} savedUrl={artwork.coverUrl} allowReference={artwork.allowReference} /></div><span className="block text-xs text-gray-500 mt-2">{entry.position == null ? '?' : `#${entry.position}`} · {owned ? 'Owned' : 'Missing'}</span><span className="block text-xs leading-snug mt-1 line-clamp-2">{entry.work.title}</span></>;
        const events = { onMouseEnter: () => setHovered(entry.id), onMouseLeave: () => setHovered(null), onFocus: () => setKeyboard(entry.id), onBlur: () => setKeyboard(null) };
        const className = 'book-carousel-card block w-full text-left rounded-lg transition-transform duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500';
        return <li key={entry.id} data-entry-id={entry.id} className="relative shrink-0 w-28 sm:w-36 hover:z-10">{owned ? <Link {...events} className={className} href={`/library/book/${artwork.editions[0].id}`} aria-label={`${entry.work.title} — Owned`}>{content}</Link> : <button {...events} type="button" className={className} aria-label={`${entry.work.title} — Missing; open checklist`} onClick={() => { if (!selected) onSelect(); }}>{content}</button>}</li>;
      })}
    </CoverCarousel>
    {!entries.length && <p className="text-sm text-gray-500 mb-4">No entries recorded yet. Open the checklist to add works.</p>}
    {children}
  </article>;
}
export function SeriesShelves({ series, selected, onSelect, details }: { series: ChecklistSeries[]; selected: string | null; onSelect: (id: string) => void; details: (series: ChecklistSeries) => ReactNode }) {
  const groups = useMemo(() => groupSeriesByAuthor(series), [series]);
  return <AlphabeticalSections groups={groups} idPrefix="series-authors">{authors => <div className="space-y-5">{authors.map(author => <div key={author.id} className="min-w-0"><h3 className="text-xl font-semibold mt-2 mb-1">{author.name}</h3>{author.series.map(item => <SeriesShelf key={item.id} series={item} selected={selected === item.id} onSelect={() => onSelect(item.id)}>{details(item)}</SeriesShelf>)}</div>)}</div>}</AlphabeticalSections>;
}
