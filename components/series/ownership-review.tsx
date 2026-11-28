"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCacheOwner } from '@/lib/offline/owner';
import type { OwnershipAction, OwnershipReview as Review } from '@/lib/series/ownership-types';
const labels = { linked: 'Saved link', matched: 'Suggested match — needs confirmation', excluded: 'Rejected match', candidate: 'Not linked' };
export function OwnershipReview({ workId, title, open, onToggle, disabled, onSaved }: { workId: string; title: string; open: boolean; onToggle: () => void; disabled: boolean; onSaved: () => Promise<void> }) {
  const owner = useCacheOwner(), epoch = useRef(0), submitting = useRef(false);
  const [reviewKey, setReviewKey] = useState('');
  const [review, setReview] = useState<Review | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [refresh, setRefresh] = useState(0);
  const [intent, setIntent] = useState<{ action: OwnershipAction; bookId: string } | null>(null), [selected, setSelected] = useState(''), [search, setSearch] = useState('');
  useEffect(() => {
    const token = ++epoch.current, controller = new AbortController();
    setReview(null); setIntent(null); setSelected(''); setSearch(''); setError(''); setBusy(false); submitting.current = false;
    if (open) fetch(`/api/works/${workId}/ownership`, { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? 'Ownership review could not be loaded.');
      if (!data.review || data.review.work?.id !== workId || !/^[a-f0-9]{64}$/.test(data.review.version) || !Array.isArray(data.review.copies)) throw new Error('Ownership evidence could not be verified. Refresh this review.');
      if (token === epoch.current) { setReview(data.review); setReviewKey(`${owner}:${workId}`); }
    }).catch(e => { if (token === epoch.current && !controller.signal.aborted) setError(e instanceof Error ? e.message : 'Ownership review could not be loaded.'); });
    return () => { epoch.current++; controller.abort(); };
  }, [open, owner, workId, refresh]);
  const current = reviewKey === `${owner}:${workId}` && review?.work.id === workId ? review : null;
  const confirm = async () => {
    if (!current || !intent || submitting.current || disabled) return;
    submitting.current = true; setBusy(true); setError(''); const token = epoch.current;
    try {
      const response = await fetch(`/api/works/${workId}/ownership`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...intent, version: current.version }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? 'Ownership change could not be saved.');
      if (token !== epoch.current) return;
      if (!data.review || data.review.work?.id !== workId || !/^[a-f0-9]{64}$/.test(data.review.version) || !Array.isArray(data.review.copies)) throw new Error('The save response could not be verified. Refresh this review to check the result.');
      setReview(data.review); setReviewKey(`${owner}:${workId}`); setIntent(null); setSelected('');
      try { await onSaved(); } catch { if (token === epoch.current) setError('Ownership was saved, but the shelf could not refresh. Refresh this review or reload Series.'); }
    } catch (e) { if (token === epoch.current) { setIntent(null); setReview(null); setError(e instanceof Error ? e.message : 'The save could not be verified. Refresh this review to check whether it completed.'); } }
    finally { if (token === epoch.current) { submitting.current = false; setBusy(false); } }
  };
  const chosen = current?.copies.find(copy => copy.id === intent?.bookId);
  const candidates = current?.copies.filter(copy => copy.state === 'candidate' && `${copy.title} ${copy.author} ${copy.isbn13 ?? ''}`.toLowerCase().includes(search.toLowerCase())) ?? [];
  return <div className="mt-3">
    <button type="button" className="text-sm text-blue-600 underline" aria-label={`Review ownership for ${title}`} aria-expanded={open} disabled={busy} onClick={onToggle}>{open ? 'Close ownership review' : 'Review ownership'}</button>
    {open && <section aria-label={`Ownership of ${title}`} className="mt-3 border rounded-xl p-4 space-y-4 bg-gray-50 dark:bg-gray-950">
      <div><h4 className="font-semibold">Which physical copy contains this work?</h4><p className="text-sm text-gray-500">Saved links and suggested matches are listed separately. Confirming a link changes no book details, reading status or reading history.</p></div>
      {error && <div role="alert" className="text-sm text-red-700"><p>{error}</p><Button size="sm" variant="secondary" type="button" disabled={disabled || busy} onClick={() => setRefresh(value => value + 1)}>Refresh ownership review</Button></div>}
      {!current && !error && <p role="status">Loading ownership evidence…</p>}
      {current && <>
        {!current.copies.some(copy => copy.state === 'linked' || copy.state === 'matched') && <p className="text-sm">No owned copy is linked or automatically matched to this work.</p>}
        <ul className="space-y-3">{current.copies.filter(copy => copy.state !== 'candidate').map(copy => <li key={copy.id} className="border rounded-lg p-3 space-y-2 bg-white dark:bg-gray-900">
          <div><Link href={`/library/book/${copy.id}`} className="font-medium text-blue-600 underline">{copy.title}</Link><p className="text-sm">{copy.author} · ISBN {copy.isbn13 ?? 'not recorded'} · {copy.readingStatus}</p></div>
          <p className="font-medium text-sm">{labels[copy.state]}</p><p className="text-sm text-gray-500">{copy.reason}</p>
          {copy.links.length > 0 && <ul className="text-xs text-gray-500">{copy.links.map(link => <li key={`${link.workId}:${link.source}`}>{link.source === 'edition' ? 'Edition relationship' : 'Contents relationship (supports omnibus copies)'}: {link.title}</li>)}</ul>}
          {copy.otherWorks.length > 0 && <p className="text-xs text-gray-500">Also linked to: {copy.otherWorks.join('; ')}.</p>}
          <div className="flex flex-wrap gap-2">{(copy.state === 'linked' ? [['unlink', 'Remove ownership link']] : copy.state === 'matched' ? [['link', 'Confirm this copy'], ['reject', 'Not this copy']] : [['allow', 'Allow matching again'], ['link', 'Link this copy']]).map(([action, label]) => <Button key={action} size="sm" variant="secondary" type="button" disabled={disabled || busy} onClick={() => setIntent({ action: action as OwnershipAction, bookId: copy.id })}>{label}</Button>)}</div>
        </li>)}</ul>
        <div className="border-t pt-3 space-y-2"><h5 className="font-medium text-sm">Choose another library copy</h5><label className="block text-sm">Search physical copies<input className="block w-full border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <label className="block text-sm">Physical copy<select className="block w-full border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={selected} onChange={event => setSelected(event.target.value)}><option value="">Select a physical copy…</option>{candidates.map(copy => <option key={copy.id} value={copy.id}>{copy.title} — {copy.author}{copy.isbn13 ? ` · ${copy.isbn13}` : ''}</option>)}</select></label>
          {current.copies.find(copy => copy.id === selected) && <p className="text-sm text-gray-500">{current.copies.find(copy => copy.id === selected)!.reason}</p>}
          <Button type="button" size="sm" variant="secondary" disabled={disabled || busy || !candidates.some(copy => copy.id === selected)} onClick={() => setIntent({ action: 'link', bookId: selected })}>Review selected copy</Button>
        </div>
        {intent && chosen && <div role="group" aria-label="Confirm ownership change" className="border border-blue-400 rounded-lg p-4 space-y-3">
          <p className="font-medium">{intent.action === 'unlink' ? 'Remove this ownership link?' : intent.action === 'reject' ? 'Reject this suggested copy?' : intent.action === 'allow' ? 'Allow automatic matching again?' : 'Confirm this physical copy?'}</p>
          <p className="text-sm"><strong>{chosen.title}</strong> by {chosen.author} → <strong>{current.work.title}</strong> by {current.work.author}</p>
          <p className="text-sm">{intent.action === 'unlink' || intent.action === 'reject' ? 'This blocks automatic rematching to this work. The physical book stays in your library, with its reading history and links to other works.' : intent.action === 'allow' ? 'This removes your rejection. A safe automatic match may count this copy as owned again; it does not save a confirmed link.' : 'This saves a contents link for the selected physical copy. Existing links to other works are preserved.'}</p>
          {chosen.otherWorks.length > 0 && <p className="text-sm">This copy also contains: {chosen.otherWorks.join('; ')}.</p>}
          <div className="flex gap-2"><Button type="button" size="sm" disabled={disabled || busy} onClick={confirm}>{busy ? 'Saving ownership…' : 'Confirm ownership change'}</Button><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setIntent(null)}>Cancel</Button></div>
        </div>}
      </>}
    </section>}
  </div>;
}
