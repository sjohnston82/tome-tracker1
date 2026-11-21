import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ScanPage from '@/app/scan/page';
const push = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('@/lib/preferences', () => ({ usePreferences: () => ({ preferences: { autoCovers: true } }) }));
vi.mock('@/components/offline/offline-guard', () => ({ OfflineGuard: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/components/scanner/barcode-scanner', () => ({ BarcodeScanner: ({ active, onScan }: { active: boolean; onScan: (code: string) => void }) => active ? <button onClick={() => { onScan('9780553579901'); onScan('9780553579901'); }}>Mock camera</button> : <p>Camera paused</p> }));
beforeEach(() => push.mockReset());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const emptyMatches = { matches: [], totalMatches: 0, exactCount: 0 };
const lookup = { isIsbn: true, normalizedIsbn: '9780670030033', owned: false, metadata: { title: 'Synaptic Self', authors: ['Joseph LeDoux'] } };

describe('scanning and catalog recovery', () => {
  it('looks up the user’s hyphenated ISBN-10 and shows the normalized number without adding a book', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url === '/api/scan/matches' ? emptyMatches : ({ ...lookup, normalizedIsbn: '9780553579901', metadata: { title: 'A Clash of Kings', authors: ['George R. R. Martin'] } }) }));
    vi.stubGlobal('fetch', fetcher); render(<ScanPage />);
    fireEvent.change(screen.getByLabelText('Printed ISBN'), { target: { value: '0-553-57990-8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up ISBN' }));
    await screen.findByText('A Clash of Kings'); expect(screen.getByText('9780553579901')).toBeDefined();
    expect(fetcher.mock.calls[0][0]).toBe('/api/lookup/isbn/9780553579901'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects a retail code instead of inventing an ISBN and prevents simultaneous lookups', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url === '/api/scan/matches' ? emptyMatches : lookup })); vi.stubGlobal('fetch', fetcher); render(<ScanPage />);
    fireEvent.change(screen.getByLabelText('Printed ISBN'), { target: { value: '030640615200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up ISBN' }));
    expect(screen.getByRole('alert').textContent).toContain('not a retail UPC'); expect(fetcher).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Mock camera' }));
    await screen.findByText('Synaptic Self'); expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([false, true])('lets users select the correct title and retain the printed ISBN only by explicit choice (%s)', async keep => {
    const fetcher = vi.fn(async (url: string, options?: RequestInit) => ({ ok: true, json: async () => url === '/api/scan/matches' ? emptyMatches : url === '/api/books' ? { book: { id: 'new-book' } } : url.includes('/search?') ? { results: [{ title: 'Lake Wobegon Summer 1956', authors: ['Garrison Keillor'], isbn13: '9780451187840', publishedYear: 2099 }] } : lookup }));
    vi.stubGlobal('fetch', fetcher); render(<ScanPage />);
    fireEvent.change(screen.getByLabelText('Printed ISBN'), { target: { value: '0-670-03003-1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Look up ISBN' })); await screen.findByText('Synaptic Self');
    fireEvent.click(screen.getByRole('button', { name: 'Wrong book or no ISBN? Search by title' }));
    fireEvent.change(screen.getByLabelText('Title and author'), { target: { value: 'Lake Wobegon Summer 1956 Keillor' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search titles' }));
    await screen.findByRole('button', { name: /Lake Wobegon Summer 1956.*Garrison Keillor/ });
    if (keep) fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: /Lake Wobegon Summer 1956.*Garrison Keillor/ }));
    expect(screen.queryByText('Synaptic Self')).toBeNull();
    expect(fetcher.mock.calls.some(([url]) => url === '/api/books')).toBe(false);
    fireEvent.click(await screen.findByRole('button', { name: 'Add to library' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/library/book/new-book'));
    const options = fetcher.mock.calls.find(([url]) => url === '/api/books')![1]!;
    expect(JSON.parse(options.body as string)).toMatchObject({ title: 'Lake Wobegon Summer 1956', authorName: 'Garrison Keillor', isbn13: keep ? '9780670030033' : null, publicationYear: null, coverUrl: null });
    expect(options.headers).toMatchObject({ 'X-Auto-Covers': 'off' });
  });
  it('lets users return to the camera after opening title search without an ISBN', () => {
    render(<ScanPage />); fireEvent.click(screen.getByRole('button', { name: 'Wrong book or no ISBN? Search by title' }));
    fireEvent.click(screen.getByRole('button', { name: 'Return to camera' }));
    expect(screen.getByRole('button', { name: 'Mock camera' })).toBeDefined(); expect(screen.queryByLabelText('Title and author')).toBeNull();
  });
});
