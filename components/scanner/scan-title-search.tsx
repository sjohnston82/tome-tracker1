"use client";
import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { SearchResult } from '@/lib/metadata/types';
import { extractIsbnFromBarcode } from '@/lib/books/isbn';

export function ScanTitleSearch({ printedIsbn, onSelect }: { printedIsbn: string; onSelect: (book: SearchResult, keepIsbn: boolean) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false), [error, setError] = useState('');
  const [keepIsbn, setKeepIsbn] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const validIsbn = extractIsbnFromBarcode(printedIsbn);
  useEffect(() => () => controller.current?.abort(), []);
  return <form className="space-y-3 border rounded-lg p-4" onSubmit={async event => {
    event.preventDefault(); controller.current?.abort();
    const request = new AbortController(); controller.current = request;
    setLoading(true); setError(''); setResults([]);
    try {
      const response = await fetch(`/api/lookup/search?q=${encodeURIComponent(query.trim())}`, { signal: request.signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Title search failed.');
      if (!request.signal.aborted) { setResults(data.results ?? []); if (!data.results?.length) setError('No titles found. Try the title with the author’s name.'); }
    } catch (cause) { if (!request.signal.aborted) setError(cause instanceof Error ? cause.message : 'Title search failed.'); }
    finally { if (!request.signal.aborted) setLoading(false); }
  }}>
    <Input label="Title and author" value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={300} required />
    <Button type="submit" loading={loading}>Search titles</Button>
    <p className="text-sm text-gray-500">Catalogs can contain incorrect ISBN assignments. Select the correct title below; a title match does not verify your physical edition.</p>
    {validIsbn && <label className="flex gap-2 items-start text-sm"><input type="checkbox" checked={keepIsbn} onChange={event => setKeepIsbn(event.target.checked)} />Keep printed ISBN {validIsbn} even if the catalog assigns it to another title.</label>}
    {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    <ul className="space-y-2">{results.map((book, index) => <li key={`${book.title}:${index}`}><button type="button" aria-label={`${book.title} — ${book.authors.join(" & ") || "Author unknown"}`} className="block w-full text-left border rounded-lg p-3 hover:bg-gray-50 dark:hover:bg-gray-800" onClick={() => onSelect(book, !!validIsbn && keepIsbn)}><strong>{book.title}</strong><span className="block text-sm text-gray-500">{book.authors.join(' & ') || 'Author unknown'}</span></button></li>)}</ul>
  </form>;
}
