"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCacheOwner } from '@/lib/offline/owner';
import { useOfflineLibrary } from '@/lib/hooks/useOfflineLibrary';
import type { ActivityTotals, FinishedRead, ReadingActivity } from '@/lib/reading/activity';

const number = (value: number) => value.toLocaleString();
const quarterNames = ['January–March', 'April–June', 'July–September', 'October–December'];
function Totals({ totals }: { totals: ActivityTotals }) {
  return <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
    {[[totals.books, 'Books finished'], [totals.pages, 'Pages logged'], [totals.activeDays, 'Days with new pages'], [totals.entries, 'Progress entries']].map(([value, label]) => <div key={label} className="border-l-2 border-blue-500 pl-3"><dt className="text-sm text-gray-500 dark:text-gray-400">{label}</dt><dd className="text-2xl font-semibold mt-1">{number(Number(value))}</dd></div>)}
  </dl>;
}
function FinishedBooks({ reads, timeZone }: { reads: FinishedRead[]; timeZone: string }) {
  if (!reads.length) return <p className="text-sm text-gray-500">No recorded completions in this period. Pages logged still count.</p>;
  return <ul className="divide-y divide-gray-200 dark:divide-gray-700">{reads.map(read => <li key={read.sessionId} className="py-3 flex flex-wrap justify-between gap-x-6 gap-y-1"><div className="min-w-0"><Link className="font-medium text-blue-700 dark:text-blue-300 hover:underline break-words" href={`/library/book/${read.bookId}`}>{read.title}</Link><p className="text-sm text-gray-500 dark:text-gray-400">{read.author}</p></div><time dateTime={read.finishedAt} className="text-sm text-gray-500">{new Intl.DateTimeFormat(undefined, { timeZone, year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(read.finishedAt))}</time></li>)}</ul>;
}
export default function ActivityPage() {
  const userId = useCacheOwner();
  const { isOnline } = useOfflineLibrary();
  const [timeZone, setTimeZone] = useState<string | null>(null);
  const [year, setYear] = useState<number | null>(null);
  const [quarter, setQuarter] = useState<number | null>(null);
  const [showYearBooks, setShowYearBooks] = useState(false);
  const [month, setMonth] = useState<number | null>(null);
  const [data, setData] = useState<ReadingActivity | null>(null);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [attempt, setAttempt] = useState(0);
  useEffect(() => { setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'); }, []);
  useEffect(() => {
    if (!userId) { setData(null); setLoading(false); return; }
    if (!timeZone || !isOnline) { if (!isOnline) setLoading(false); return; }
    const controller = new AbortController(); setLoading(true); setError(''); setData(null);
    const params = new URLSearchParams({ timeZone }); if (year !== null) params.set('year', String(year));
    void (async () => {
      try {
        const response = await fetch(`/api/reading/activity?${params}`, { cache: 'no-store', signal: controller.signal });
        const result = await response.json().catch(() => { throw new Error('Reading activity could not be loaded. Please try again.'); });
        if (!response.ok) throw new Error(result.message ?? 'Reading activity could not be loaded.');
        if (!controller.signal.aborted) setData(result);
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Reading activity could not be loaded.'); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    })();
    return () => controller.abort();
  }, [timeZone, year, attempt, isOnline, userId]);
  const selectedQuarter = data ? data.quarters[(quarter ?? (data.year === data.currentYear ? data.currentQuarter : ([...data.quarters].reverse().find(q => q.entries || q.completedReads)?.quarter ?? 4))) - 1] : null;
  const selectedMonth = data && month !== null ? data.months[month - 1] : null;
  const finished = data?.quarters.flatMap(q => q.finished) ?? [];
  return <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
    <header><p className="text-xs font-semibold tracking-widest uppercase text-blue-700 dark:text-blue-300">Your reading, recorded</p><h1 className="text-3xl font-bold mt-2">Reading Activity</h1><p className="text-gray-600 dark:text-gray-400 mt-2">The books you finished, the pages you logged, and how your reading took shape.</p></header>
    {!userId ? <p>Sign in to view your reading activity. <Link href="/login" className="text-blue-600 underline">Sign in</Link></p> : !isOnline ? <div role="status" className="border rounded-xl p-5 space-y-2"><h2 className="font-semibold">Reading activity needs a connection</h2><p>Reconnect to load your latest logs and recaps. Your downloaded library is still available.</p><Link href="/library" className="text-blue-600 underline">Open library</Link></div> : <>
    {loading && <p role="status">Loading reading activity…</p>}
    {error && <div role="alert" className="space-y-3"><p className="text-red-600">{error}</p><Button variant="secondary" onClick={() => setAttempt(value => value + 1)}>Retry activity</Button></div>}
    {data && !loading && <>
      <section aria-label="Yearly reading totals" className="space-y-5">
        <div className="flex flex-wrap justify-between gap-3 items-end"><div><h2 className="text-xl font-semibold">Your year in reading</h2><p className="text-sm text-gray-500">Calendar dates in {data.timeZone.replaceAll('_', ' ')}.</p></div><label className="text-sm font-medium">Year<select aria-label="Activity year" className="block border rounded-lg p-2 mt-1 bg-white dark:bg-gray-900" value={data.year} onChange={event => { setYear(Number(event.target.value)); setQuarter(null); setMonth(null); setShowYearBooks(false); }}>{data.availableYears.map(value => <option key={value} value={value}>{value}</option>)}</select></label></div>
        <Totals totals={data.totals} />
        {data.totals.completedReads > data.totals.books && <p className="text-sm text-gray-500">{number(data.totals.completedReads)} completed reads across {number(data.totals.books)} unique books, including rereads.</p>}
        {!!finished.length && <div className="space-y-3"><button type="button" className="text-sm text-blue-700 dark:text-blue-300 underline" aria-expanded={showYearBooks} aria-controls="year-finished-books" onClick={() => setShowYearBooks(value => !value)}>{showYearBooks ? 'Hide' : 'View'} all finished books in {data.year}</button>{showYearBooks && <div id="year-finished-books"><FinishedBooks reads={[...finished].sort((a, b) => b.finishedAt.localeCompare(a.finishedAt))} timeZone={data.timeZone} /></div>}</div>}
        {!data.totals.entries && !data.totals.completedReads && <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-5 space-y-2"><h3 className="font-semibold">Your {data.year} story starts with a reading log</h3><p className="text-sm">Open an unread or currently reading book and record your next stopping point. Historical Read labels remain separate.</p><Link href="/library" className="text-blue-700 dark:text-blue-300 underline text-sm">Find a book in your library</Link></div>}
      </section>
      <section aria-labelledby="monthly-pages-title" className="space-y-4">
        <div><h2 id="monthly-pages-title" className="text-xl font-semibold">Pages by month</h2><p className="text-sm text-gray-500">New pages reached at recorded stopping points · {data.year}. Select a month for details.</p></div>
        <div className="border rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">{data.months.map(item => <button key={item.month} type="button" aria-pressed={month === item.month} aria-label={`${item.label}: ${number(item.pages)} pages logged, ${item.books} books finished`} onClick={() => setMonth(previous => previous === item.month ? null : item.month)} className={`w-full grid grid-cols-[3rem_minmax(0,1fr)_4rem] sm:grid-cols-[6rem_minmax(0,1fr)_5rem] gap-3 items-center text-left px-4 py-2.5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600 ${month === item.month ? 'bg-blue-50 dark:bg-blue-950' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}>
          <span className="text-sm"><span className="sm:hidden">{item.label.slice(0, 3)}</span><span className="hidden sm:inline">{item.label}</span></span><span aria-hidden="true" className="h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden"><span className="block h-full bg-blue-600 dark:bg-blue-400 rounded-full" style={{ width: `${item.pages / Math.max(1, ...data.months.map(m => m.pages)) * 100}%` }} /></span><span className="text-sm text-right tabular-nums">{number(item.pages)}</span>
        </button>)}</div><p className="text-xs text-gray-500">Bar length shows pages logged; exact page counts appear on the right. Empty months have zero recorded pages.</p>
        {selectedMonth && <div className="border rounded-xl p-4 space-y-3" aria-live="polite"><h3 className="font-semibold">{selectedMonth.label} {data.year}</h3><p className="text-sm">{number(selectedMonth.pages)} pages · {selectedMonth.activeDays} days with new pages · {selectedMonth.completedReads} completed reads</p><FinishedBooks reads={finished.filter(read => Number(read.day.slice(5, 7)) === selectedMonth.month)} timeZone={data.timeZone} /></div>}
      </section>
      {selectedQuarter && <section aria-labelledby="quarter-title" className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-5 sm:p-6 space-y-5">
        <div className="flex flex-wrap justify-between items-end gap-3"><div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700 dark:text-blue-300">Quarterly recap{selectedQuarter.state === 'in-progress' ? ' · So far' : selectedQuarter.state === 'upcoming' ? ' · Upcoming' : ''}</p><h2 id="quarter-title" className="text-2xl font-semibold mt-2">Q{selectedQuarter.quarter} {data.year}</h2><p className="text-sm text-gray-500">{quarterNames[selectedQuarter.quarter - 1]}</p></div><label className="text-sm font-medium">Quarter<select aria-label="Recap quarter" className="block border rounded-lg p-2 mt-1 bg-white dark:bg-gray-800" value={selectedQuarter.quarter} onChange={event => setQuarter(Number(event.target.value))}>{data.quarters.map(q => <option key={q.quarter} value={q.quarter}>Q{q.quarter}{q.state === 'in-progress' ? ' · so far' : q.state === 'upcoming' ? ' · upcoming' : ''}</option>)}</select></label></div>
        <Totals totals={selectedQuarter} />
        {selectedQuarter.completedReads > selectedQuarter.books && <p className="text-sm">{selectedQuarter.completedReads} completed reads across {selectedQuarter.books} unique books, including rereads.</p>}
        {selectedQuarter.state === 'upcoming' ? <p className="text-sm text-gray-500">This quarter has not started. Its recap will grow as you record activity.</p> : <>
          {selectedQuarter.busiestMonth && <div className="border-t dark:border-gray-700 pt-4 space-y-2"><h3 className="font-semibold">From your recorded activity</h3><p className="text-sm">{selectedQuarter.busiestMonth.label} had the most logged pages this quarter ({number(selectedQuarter.busiestMonth.pages)}{data.months.filter(m => Math.ceil(m.month / 3) === selectedQuarter.quarter && m.pages === selectedQuarter.busiestMonth!.pages).length > 1 ? ', tied with another month' : ''}).</p><p className="text-sm">You logged an average of {selectedQuarter.averagePagesPerActiveDay} new pages on days with progress. This reflects logged stops, not reading speed or time spent.</p></div>}
          <div><h3 className="font-semibold mb-2">Books you finished</h3><FinishedBooks reads={selectedQuarter.finished} timeZone={data.timeZone} /></div>
        </>}
      </section>}
      <aside className="border-t dark:border-gray-700 pt-5 space-y-3 text-sm text-gray-600 dark:text-gray-400"><p><strong className="text-gray-900 dark:text-gray-100">{number(data.undatedReadBooks)} Read {data.undatedReadBooks === 1 ? 'book has' : 'books have'} no recorded finish date.</strong> These remain in your collection’s read count and are excluded from yearly and quarterly completions.</p><details><summary className="cursor-pointer font-medium">How these numbers work</summary><div className="mt-3 space-y-2"><p>Only progress beyond a session’s starting page and previous highest page counts. Revisiting pages adds no extra pages. A new reading session can count a reread.</p><p>Pages belong to the date you logged reaching them. Gaps between entries are not filled in, and the app does not estimate reading duration. Completion dates come from finished reading sessions, not a book’s Read label.</p><p>Corrections and removed entries recalculate these totals. Books finished counts unique physical library records in each period; completed reads includes repeat sessions. Older data is never assigned an invented date.</p></div></details><Button variant="ghost" onClick={() => setAttempt(value => value + 1)}>Refresh reading activity</Button></aside>
    </>}
    </>}
  </div>;
}
