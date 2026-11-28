"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCacheOwner } from '@/lib/offline/owner';
import { useOfflineLibrary } from '@/lib/hooks/useOfflineLibrary';
import type { ReviewAction, ReviewItem, ReviewQueue } from '@/lib/review/types';
const labels = { conflict: 'Import conflicts', edition: 'Edition matches', series: 'Series order', missing: 'Missing details' };
function ReviewCard({ item, disabled, onAction }: { item: ReviewItem; disabled: boolean; onAction: (item: ReviewItem, action: ReviewAction, extra?: { value?: number; candidateId?: string }) => Promise<void> }) {
  const [confirm, setConfirm] = useState<ReviewAction | null>(null);
  const [year, setYear] = useState(''), [candidate, setCandidate] = useState('');
  return <article aria-label={item.title} className="rounded-xl border border-gray-200 dark:border-gray-700 p-5 space-y-3">
    <div className="flex justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{labels[item.category]}{item.blocking ? ' · Blocks import' : ''}{item.resolved ? ' · Reviewed' : ''}</p><h2 className="text-lg font-semibold mt-1">{item.title}</h2>{item.author && <p className="text-sm text-gray-600 dark:text-gray-400">{item.author}</p>}</div></div>
    <p className="text-sm text-gray-500">{item.ownership}</p><p>{item.message}</p>
    <dl className="grid sm:grid-cols-2 gap-3 text-sm"><div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-lg"><dt className="font-medium">Library value</dt><dd className="mt-1 break-words">{item.current}</dd></div>{item.proposed !== null && <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg"><dt className="font-medium">Source value</dt><dd className="mt-1 break-words">{item.proposed}</dd></div>}</dl>
    {item.source && <p className="text-xs text-gray-500">Source: {item.source}</p>}
    <div className="flex flex-wrap gap-2 items-center">
      {item.actions.includes('keep') && <Button size="sm" variant="secondary" disabled={disabled} onClick={() => void onAction(item, 'keep')}>Keep library value / mark reviewed</Button>}
      {item.actions.includes('source') && <Button size="sm" disabled={disabled} onClick={() => setConfirm('source')}>Use source value…</Button>}
      {item.actions.includes('confirm') && <Button size="sm" disabled={disabled} onClick={() => setConfirm('confirm')}>Confirm recorded order…</Button>}
      {item.actions.includes('reopen') && <Button size="sm" variant="secondary" disabled={disabled} onClick={() => void onAction(item, 'reopen')}>Reopen review</Button>}
      <Link href={item.href} className="text-sm text-blue-600 underline px-2 py-1">{item.linkLabel}</Link>
    </div>
    {item.actions.includes('year') && <form className="flex flex-wrap items-end gap-3" onSubmit={event => { event.preventDefault(); void onAction(item, 'year', { value: Number(year) }); }}><Input label="Verified publication year" type="number" min={1} max={9999} step={1} required value={year} onChange={event => setYear(event.target.value)} disabled={disabled} /><Button type="submit" size="sm" disabled={disabled}>Save verified year</Button></form>}
    {item.actions.includes('pin') && <div className="space-y-3"><label className="block text-sm">Existing record for this source row<select className="block border rounded-lg p-2 mt-1 w-full bg-white dark:bg-gray-900" value={candidate} disabled={disabled} onChange={event => setCandidate(event.target.value)}><option value="">Choose a record…</option>{item.candidates.map(book => <option key={book.id} value={book.id}>{book.title} — {book.author}</option>)}</select></label><Button size="sm" disabled={disabled || !candidate} onClick={() => setConfirm('pin')}>Use this existing record…</Button></div>}
    {confirm && <div className="border border-blue-300 bg-blue-50 dark:bg-blue-950 rounded-lg p-4 space-y-3"><p>{confirm === 'pin' ? 'Use the selected existing record for this import row? Its saved metadata and reading history will be preserved.' : confirm === 'confirm' ? `Confirm this recorded series order: ${item.current}?` : `Replace the displayed library value with “${item.proposed}”? This will not add physical books or invent reading dates.`}</p><Button size="sm" disabled={disabled} onClick={() => { void onAction(item, confirm, confirm === 'pin' ? { candidateId: candidate } : undefined).then(() => setConfirm(null)); }}>Confirm change</Button><Button size="sm" variant="ghost" disabled={disabled} onClick={() => setConfirm(null)}>Cancel</Button></div>}
  </article>;
}
export default function MetadataReviewPage() {
  const owner = useCacheOwner(), { isOnline } = useOfflineLibrary();
  const ownerRef = useRef(owner); ownerRef.current = owner;
  const mutation = useRef(false);
  const epoch = useRef(0);
  const [data, setData] = useState<{ owner: string; queue: ReviewQueue } | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [attempt, setAttempt] = useState(0), [category, setCategory] = useState('all'), [status, setStatus] = useState('open'), [search, setSearch] = useState(''), [limit, setLimit] = useState(30);
  useEffect(() => { epoch.current++; mutation.current = false; setBusy(false); }, [owner]);
  useEffect(() => {
    const controller = new AbortController(); setData(null); setError(''); setNotice('');
    if (!owner || !isOnline) { setLoading(false); return; }
    setLoading(true);
    void (async () => {
      try {
        const response = await fetch('/api/metadata-review', { cache: 'no-store', signal: controller.signal });
        const result = await response.json(); if (!response.ok) throw new Error(result.message || 'The review list could not be loaded.');
        if (!controller.signal.aborted && ownerRef.current === owner) setData({ owner, queue: result });
      } catch (cause) { if (!controller.signal.aborted && ownerRef.current === owner) setError(cause instanceof Error ? cause.message : 'The review list could not be loaded.'); }
      finally { if (!controller.signal.aborted && ownerRef.current === owner) setLoading(false); }
    })();
    return () => controller.abort();
  }, [owner, isOnline, attempt]);
  const act = async (item: ReviewItem, action: ReviewAction, extra?: { value?: number; candidateId?: string }) => {
    if (mutation.current || !owner || !isOnline) return;
    const account = owner, generation = epoch.current; mutation.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/metadata-review', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: item.id, version: item.version, action, ...extra }) });
      const result = await response.json(); if (!response.ok) throw new Error(result.message || 'The review change could not be saved.');
      if (ownerRef.current !== account || generation !== epoch.current) return;
      const refreshed = await fetch('/api/metadata-review', { cache: 'no-store' }); const queue = await refreshed.json();
      if (!refreshed.ok) throw new Error('The change was saved, but the list could not be refreshed. Refresh before continuing.');
      if (ownerRef.current === account && generation === epoch.current) { setData({ owner: account, queue }); setNotice(action === 'keep' ? 'Marked reviewed. Your library values were preserved.' : action === 'reopen' ? 'Review reopened.' : action === 'pin' ? 'Existing record selected. Its metadata was preserved. Preview the collection again in Series before importing.' : 'Your confirmed correction was saved.'); }
    } catch (cause) { if (ownerRef.current === account && generation === epoch.current) setError(cause instanceof Error ? cause.message : 'The review change could not be saved.'); }
    finally { if (generation === epoch.current) { mutation.current = false; if (ownerRef.current === account) setBusy(false); } }
  };
  const queue = data?.owner === owner ? data.queue : null;
  const filtered = (queue?.items ?? []).filter(item => (category === 'all' || item.category === category) && (status === 'all' || item.resolved === (status === 'reviewed')) && `${item.title} ${item.author} ${item.message} ${item.source ?? ''}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="max-w-4xl mx-auto px-4 py-6 space-y-6"><div><p className="text-xs font-semibold tracking-widest uppercase text-blue-600">Your catalog, checked</p><h1 className="text-3xl font-bold mt-2">Metadata review</h1><p className="text-gray-600 dark:text-gray-400 mt-2">Compare source conflicts, confirm series order, and fill verified details. Missing information can stay unknown; ownership and reading history are preserved.</p></div>
    <Link href="/library" className="inline-block text-blue-600 underline">← Back to library</Link>
    {!owner ? <p>Sign in to review your catalog.</p> : !isOnline ? <p role="status">Reconnect to review or change metadata. Your downloaded library is still available offline.</p> : <>
      {loading && <p role="status">Loading review items…</p>}
      {error && <div className="space-y-3"><p role="alert" className="text-red-600">{error}</p><Button variant="secondary" disabled={busy} onClick={() => setAttempt(value => value + 1)}>Refresh review list</Button></div>}
      {notice && <p role="status" className="text-green-700 dark:text-green-300">{notice}</p>}
      {queue && <>
        <p className="font-medium">{queue.summary.open} open items · {queue.summary.reviewed} reviewed source questions</p>
        <p className="text-sm text-gray-500">Missing details are optional suggestions. Reviewed lists discrepancies you chose to keep; corrected items leave the queue automatically.</p>
        {queue.pendingImport && <p className="border rounded-lg p-4 text-sm">A saved import preview is being reviewed. Choosing a source match does not import new books. <Link href="/series" className="text-blue-600 underline">Return to Series to preview the same manifest and apply it.</Link></p>}
        <div className="flex flex-wrap gap-3"><label className="text-sm">Category<select aria-label="Review category" className="block border rounded-lg p-2 mt-1 bg-white dark:bg-gray-900" value={category} onChange={event => { setCategory(event.target.value); setLimit(30); }}><option value="all">All categories</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label} ({queue.summary.categories[key as keyof typeof labels]})</option>)}</select></label><label className="text-sm">State<select aria-label="Review state" className="block border rounded-lg p-2 mt-1 bg-white dark:bg-gray-900" value={status} onChange={event => { setStatus(event.target.value); setLimit(30); }}><option value="open">Open</option><option value="reviewed">Reviewed</option><option value="all">All</option></select></label></div>
        <Input label="Search review items" type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(30); }} />
        <div className="space-y-4">{filtered.slice(0, limit).map(item => <ReviewCard key={`${item.id}:${item.version}`} item={item} disabled={busy || !!error} onAction={act} />)}</div>
        {!filtered.length && <p>No review items match these filters.</p>}
        {filtered.length > limit && <Button variant="secondary" onClick={() => setLimit(value => value + 30)}>Show more ({filtered.length - limit} remaining)</Button>}
      </>}
    </>}
  </div>;
}
