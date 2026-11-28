import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ScanLibraryReview } from '@/components/scanner/scan-library-review';
import type { ScanMatch } from '@/lib/books/scan-matches';
const candidate: ScanMatch = { id: 'existing', title: 'A Clash of Kings', author: 'George R. R. Martin', isbn13: null, isbn10: null, readingStatus: 'READING', coverUrl: null, publicationYear: 1998, updatedAt: '2026-11-21T12:00:00.000Z', kind: 'title-author', reason: 'Title and author match', canLink: true };
const metadata = { title: 'A Clash of Kings', authors: ['George R. R. Martin'] };
function mount() { const onAdd = vi.fn(), onViewBook = vi.fn(); render(<ScanLibraryReview isbn="9780553579901" metadata={metadata} saving={false} actionError={null} onAdd={onAdd} onViewBook={onViewBook} onScanAgain={vi.fn()} />); return { onAdd, onViewBook }; }
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('scan review decisions', () => {
  it('requires explicit confirmation before linking and never posts another book', async () => {
    const fetcher = vi.fn(async (url: string, _options?: RequestInit) => ({ ok: true, json: async () => url === '/api/scan/matches' ? { matches: [candidate], totalMatches: 1, exactCount: 0 } : { bookId: candidate.id } })); vi.stubGlobal('fetch', fetcher);
    const { onAdd, onViewBook } = mount();
    await screen.findByText('Possible existing copies'); expect(screen.getByText('Currently reading · 1998')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Link to this copy' })); expect(fetcher).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel link' })); expect(fetcher).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Link to this copy' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm link' }));
    await screen.findByText('ISBN linked to your existing copy. No new book was added.');
    expect(fetcher.mock.calls[1][0]).toBe('/api/books/existing/isbn'); expect(fetcher.mock.calls[1][1]?.method).toBe('PATCH');
    expect(JSON.parse(fetcher.mock.calls[1][1]?.body as string)).toEqual({ isbn: '9780553579901', expectedUpdatedAt: candidate.updatedAt });
    expect(onAdd).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'View existing book' })); expect(onViewBook).toHaveBeenCalledWith('existing');
  });
  it('requires acknowledging a separate edition before adding and does not offer to replace another ISBN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ matches: [{ ...candidate, isbn13: '9780306406157', canLink: false }], totalMatches: 1, exactCount: 0 }) }));
    const { onAdd } = mount(); const button = await screen.findByRole('button', { name: 'Add another edition' });
    expect((button as HTMLButtonElement).disabled).toBe(true); expect(screen.queryByRole('button', { name: 'Link to this copy' })).toBeNull();
    fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(button); expect(onAdd).toHaveBeenCalledOnce();
  });
  it('uses the existing record for exact ISBNs even when the external catalog has wrong metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ matches: [{ ...candidate, title: 'My corrected title', isbn13: '9780553579901', kind: 'isbn', canLink: false }], exactCount: 1, totalMatches: 1 }) }));
    mount(); await screen.findByText('You own this edition'); expect(screen.getByText('My corrected title')).toBeDefined(); expect(screen.queryByText('A Clash of Kings')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add to library' })).toBeNull(); expect(screen.queryByRole('checkbox')).toBeNull();
  });
  it('blocks addition after a failed library check and lets users retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Connection lost')).mockResolvedValueOnce({ ok: true, json: async () => ({ matches: [], exactCount: 0, totalMatches: 0 }) }));
    const { onAdd } = mount(); await screen.findByText('Connection lost'); expect(onAdd).not.toHaveBeenCalled(); expect(screen.queryByRole('button', { name: 'Add to library' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Retry library check' })); fireEvent.click(await screen.findByRole('button', { name: 'Add to library' })); expect(onAdd).toHaveBeenCalledOnce();
  });
  it('shows a stale-link error with a fresh-check action without assuming the link succeeded', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: url === '/api/scan/matches', json: async () => url === '/api/scan/matches' ? { matches: [candidate], totalMatches: 1, exactCount: 0 } : { error_code: 'STALE_BOOK', message: 'This copy changed since your review.' } })));
    mount(); fireEvent.click(await screen.findByRole('button', { name: 'Link to this copy' })); fireEvent.click(screen.getByRole('button', { name: 'Confirm link' }));
    await screen.findByText('This copy changed since your review.'); expect(screen.queryByText('ISBN linked to your existing copy. No new book was added.')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Check matches again' })); await waitFor(() => expect(screen.queryByRole('button', { name: 'Confirm link' })).toBeNull());
  });
});
