import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import MetadataReviewPage from '@/app/library/review/page';
import type { ReviewItem, ReviewQueue } from '@/lib/review/types';
const state = vi.hoisted(() => ({ owner: 'owner', online: true }));
vi.mock('@/lib/offline/owner', () => ({ useCacheOwner: () => state.owner }));
vi.mock('@/lib/hooks/useOfflineLibrary', () => ({ useOfflineLibrary: () => ({ isOnline: state.online }) }));
const item = (changes: Partial<ReviewItem> = {}): ReviewItem => ({ id: 'a'.repeat(64), version: 'b'.repeat(64), fingerprint: 'c'.repeat(64), category: 'conflict', code: 'PUBLICATION_CONFLICT', title: 'My Book', author: 'An Author', message: 'Existing publication year is preserved.', current: '2005', proposed: '1952', source: 'master.xlsx · row 2', ownership: 'Owned physical copy', href: '/library/book/book', linkLabel: 'Open book', resolved: false, blocking: false, actions: ['keep', 'source'], candidates: [], ...changes });
const queue = (items: ReviewItem[]): ReviewQueue => ({ items, summary: { open: items.filter(item => !item.resolved).length, reviewed: items.filter(item => item.resolved).length, categories: { conflict: 1, edition: 0, missing: 0, series: 0 } }, pendingImport: false });
beforeEach(() => { state.owner = 'owner'; state.online = true; });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('metadata review page', () => {
  it('shows side-by-side values and requires confirmation before using source metadata', async () => {
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => ({ ok: true, json: async () => options?.method === 'PATCH' ? { success: true } : queue([item()]) })); vi.stubGlobal('fetch', fetcher);
    render(<MetadataReviewPage />); const card = await screen.findByRole('article', { name: 'My Book' });
    expect(within(card).getByText('2005')).toBeDefined(); expect(within(card).getByText('1952')).toBeDefined(); expect(within(card).getByText(/master.xlsx/)).toBeDefined();
    fireEvent.click(within(card).getByRole('button', { name: 'Use source value…' })); expect(fetcher).toHaveBeenCalledOnce();
    fireEvent.click(within(card).getByRole('button', { name: 'Cancel' })); expect(fetcher).toHaveBeenCalledOnce();
    fireEvent.click(within(card).getByRole('button', { name: 'Use source value…' })); fireEvent.click(within(card).getByRole('button', { name: 'Confirm change' }));
    await screen.findByText('Your confirmed correction was saved.');
    expect(JSON.parse(fetcher.mock.calls.find(([, options]) => options?.method === 'PATCH')![1]!.body as string)).toEqual({ id: item().id, version: item().version, action: 'source' });
  });
  it('marks a conflict reviewed without changing metadata and supports reopening it', async () => {
    let reviewed = false;
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
      if (options?.method === 'PATCH') reviewed = JSON.parse(options.body as string).action === 'keep';
      return { ok: true, json: async () => options?.method === 'PATCH' ? { success: true } : queue([item({ resolved: reviewed, actions: reviewed ? ['reopen'] : ['keep', 'source'] })]) };
    }); vi.stubGlobal('fetch', fetcher); render(<MetadataReviewPage />);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep library value / mark reviewed' })); await screen.findByText('Marked reviewed. Your library values were preserved.');
    expect(screen.queryByRole('article')).toBeNull(); fireEvent.change(screen.getByRole('combobox', { name: 'Review state' }), { target: { value: 'reviewed' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Reopen review' })); await screen.findByText('Review reopened.');
    expect(fetcher.mock.calls.filter(([, options]) => options?.method === 'PATCH').map(([, options]) => JSON.parse(options!.body as string).action)).toEqual(['keep', 'reopen']);
  });
  it('filters missing information and saves only a manually verified year', async () => {
    const missing = item({ id: 'd'.repeat(64), title: 'Unowned work', category: 'missing', code: 'MISSING_WORK_YEAR', current: 'Unknown', proposed: null, ownership: 'Series work — not an owned physical book', actions: ['year'] });
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => ({ ok: true, json: async () => options?.method === 'PATCH' ? { success: true } : queue([item(), missing]) })); vi.stubGlobal('fetch', fetcher); render(<MetadataReviewPage />);
    await screen.findByText('Unowned work'); fireEvent.change(screen.getByRole('combobox', { name: 'Review category' }), { target: { value: 'missing' } });
    expect(screen.queryByText('My Book')).toBeNull(); fireEvent.change(screen.getByLabelText('Verified publication year'), { target: { value: '2027' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save verified year' })); await screen.findByText('Your confirmed correction was saved.');
    expect(JSON.parse(fetcher.mock.calls.find(([, options]) => options?.method === 'PATCH')![1]!.body as string)).toMatchObject({ action: 'year', value: 2027 });
  });
  it('keeps failures visible and requires refreshing a stale review before another action', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, options?: RequestInit) => ({ ok: options?.method !== 'PATCH', json: async () => options?.method === 'PATCH' ? { message: 'The item changed. Refresh the review list.' } : queue([item()]) })));
    render(<MetadataReviewPage />); fireEvent.click(await screen.findByRole('button', { name: 'Keep library value / mark reviewed' }));
    await screen.findByRole('alert'); expect((screen.getByRole('button', { name: 'Keep library value / mark reviewed' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Refresh review list' })); await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
  it('does not fetch or offer mutations while offline', () => {
    state.online = false; const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher); render(<MetadataReviewPage />);
    expect(screen.getByText(/Reconnect to review/)).toBeDefined(); expect(fetcher).not.toHaveBeenCalled();
  });
  it('discards a previous account’s delayed response after switching accounts', async () => {
    let finish!: (response: unknown) => void;
    vi.stubGlobal('fetch', vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue({ ok: true, json: async () => queue([]) }));
    const { rerender } = render(<MetadataReviewPage />); state.owner = 'other'; rerender(<MetadataReviewPage />); await screen.findByText('0 open items · 0 reviewed source questions');
    await act(async () => finish({ ok: true, json: async () => queue([item()]) }));
    expect(screen.queryByText('My Book')).toBeNull();
  });
});
