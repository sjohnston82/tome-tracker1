"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookCover } from '@/components/library/book-cover';
import { Button } from '@/components/ui/button';
import type { BookMetadata } from '@/lib/metadata/types';
import type { ScanMatch, ScanMatches } from '@/lib/books/scan-matches';

const statusLabel: Record<string, string> = { READ: 'Read', UNREAD: 'Unread', READING: 'Currently reading', UNKNOWN: 'Reading status unknown' };
export function ScanLibraryReview({ isbn, metadata, saving, actionError, onAdd, onViewBook, onScanAgain }: {
  isbn: string | null; metadata: BookMetadata | null; saving: boolean; actionError: string | null;
  onAdd: () => void; onViewBook: (id: string) => void; onScanAgain: () => void;
}) {
  const title = metadata?.title ?? '', authors = JSON.stringify(metadata?.authors ?? []);
  const key = JSON.stringify([isbn, title, authors]);
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; data: ScanMatches | null; error: string }>({ key: '', data: null, error: '' });
  const [confirm, setConfirm] = useState<string | null>(null), [separate, setSeparate] = useState(false);
  const [linking, setLinking] = useState(false), [linkError, setLinkError] = useState('');
  const [linked, setLinked] = useState<ScanMatch | null>(null), [conflictId, setConflictId] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setState({ key, data: null, error: '' }); setConfirm(null); setSeparate(false); setLinked(null); setLinkError(''); setConflictId(null);
    void (async () => {
      try {
        const response = await fetch('/api/scan/matches', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isbn, ...(title ? { title, authors: JSON.parse(authors) } : {}) }), signal: controller.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.matches)) throw new Error(data.message || 'Your library could not be checked.');
        if (!controller.signal.aborted) setState({ key, data, error: '' });
      } catch (cause) { if (!controller.signal.aborted) setState({ key, data: null, error: cause instanceof Error ? cause.message : 'Your library could not be checked.' }); }
    })();
    return () => controller.abort();
  }, [isbn, title, authors, key, attempt]);
  const refresh = () => setAttempt(value => value + 1);
  const busy = saving || linking;
  if (state.key !== key || (!state.data && !state.error)) return <p role="status">Checking your library for existing copies…</p>;
  if (state.error) return <section className="border rounded-xl p-5 space-y-3"><p role="alert">{state.error}</p><p className="text-sm text-gray-500">Check your library before adding this book to avoid a duplicate.</p><Button onClick={refresh}>Retry library check</Button><Button variant="ghost" onClick={onScanAgain}>Scan again</Button></section>;
  if (linked) return <section className="border border-green-300 rounded-xl p-5 space-y-3"><p role="status">ISBN linked to your existing copy. No new book was added.</p><h2 className="font-semibold">{linked.title}</h2><Button onClick={() => onViewBook(linked.id)}>View existing book</Button><Button variant="secondary" onClick={onScanAgain}>Scan another</Button></section>;
  const data = state.data!;
  const exact = data.matches.filter(book => book.kind === 'isbn');
  const candidates = data.exactCount ? exact : data.matches;
  const link = async (book: ScanMatch) => {
    if (busy || !isbn) return;
    setLinking(true); setLinkError(''); setConflictId(null);
    try {
      const response = await fetch(`/api/books/${book.id}/isbn`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isbn, expectedUpdatedAt: book.updatedAt }) });
      const result = await response.json();
      if (!response.ok) { setConflictId(result.details?.existingBookId ?? null); throw new Error(result.message || 'ISBN could not be linked.'); }
      setLinked(book);
    } catch (cause) { setLinkError(cause instanceof Error ? cause.message : 'ISBN could not be linked.'); }
    finally { setLinking(false); }
  };
  return <section aria-label="Review scanned book" className="space-y-4">
    {!!data.exactCount && <h2 className="text-lg font-semibold text-green-700 dark:text-green-300">{data.exactCount === 1 ? 'You own this edition' : 'This ISBN appears on multiple existing copies'}</h2>}
    {!data.exactCount && metadata && <div className="border rounded-xl p-5 flex gap-4"><div className="w-20 shrink-0"><BookCover url={metadata.coverUrl ?? null} title={metadata.title} thumbnail /></div><div><h2 className="font-semibold text-lg">{metadata.title}</h2><p>{metadata.authors.join(' & ')}</p>{(metadata.publisher || metadata.publishedYear) && <p className="text-sm text-gray-500">Catalog edition: {[metadata.publisher, metadata.publishedYear].filter(Boolean).join(' · ')}</p>}</div></div>}
    {!data.exactCount && !!candidates.length && <div><h3 className="font-semibold">Possible existing copies</h3><p className="text-sm text-gray-500">These are suggestions. Confirm your physical copy before linking, or add a separate edition.</p></div>}
    <ul className="space-y-3">{candidates.map(book => <li key={book.id} className="border rounded-xl p-4 space-y-2">
      <div><h3 className="font-semibold">{book.title}</h3><p>{book.author}</p><p className="text-sm text-gray-500">{statusLabel[book.readingStatus] ?? book.readingStatus}{book.publicationYear ? ` · ${book.publicationYear}` : ''}</p></div>
      <p className="text-sm">{book.reason}</p>
      <p className="text-sm text-gray-500">{book.isbn13 || book.isbn10 ? `Recorded ISBN: ${book.isbn13 || book.isbn10}` : 'No ISBN recorded'}{isbn && !book.canLink && book.kind !== 'isbn' ? ' · Different edition or existing ISBN; it will be preserved.' : ''}</p>
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="secondary" disabled={busy} onClick={() => onViewBook(book.id)}>View existing book</Button>
        {book.canLink && <Button size="sm" disabled={busy} onClick={() => { setConfirm(book.id); setLinkError(''); }}>Link to this copy</Button>}
      </div>
      {confirm === book.id && <div className="bg-blue-50 dark:bg-blue-950 rounded-lg p-3 space-y-3"><p>Confirm that ISBN <strong className="font-mono">{isbn}</strong> belongs to this physical copy of <strong>{book.title}</strong>. Only its missing ISBN will be filled; your reading history and saved details stay in place.</p><Button size="sm" loading={linking} disabled={saving} onClick={() => void link(book)}>Confirm link</Button><Button size="sm" variant="ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancel link</Button></div>}
    </li>)}</ul>
    {data.totalMatches > data.matches.length && <p className="text-sm text-gray-500">Showing the {data.matches.length} closest of {data.totalMatches} matches. <Link href="/library" className="underline">Open library</Link> to review the rest.</p>}
    {(linkError || actionError) && <div className="space-y-2"><p role="alert" className="text-red-600">{linkError || actionError}</p>{conflictId && <Button variant="secondary" onClick={() => onViewBook(conflictId)}>View copy with this ISBN</Button>}{linkError && <Button variant="secondary" disabled={busy} onClick={refresh}>Check matches again</Button>}</div>}
    {!data.exactCount && metadata && <div className="border-t pt-4 space-y-3">
      {!!candidates.length && <label className="flex items-start gap-2 text-sm"><input type="checkbox" disabled={busy} checked={separate} onChange={event => setSeparate(event.target.checked)} />This is a separate physical copy or edition, not one of the records above.</label>}
      <Button loading={saving} disabled={linking || (!!candidates.length && !separate)} onClick={onAdd}>{candidates.length ? 'Add another edition' : 'Add to library'}</Button>
    </div>}
    {!data.exactCount && !metadata && <p>No catalog details were found. Use title search above to check the correct book.</p>}
    <Button variant="secondary" disabled={busy} onClick={onScanAgain}>{data.exactCount ? 'Scan another' : 'Scan again'}</Button>
  </section>;
}
