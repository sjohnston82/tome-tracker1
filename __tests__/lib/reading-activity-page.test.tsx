import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { buildReadingActivity, type ActivitySession } from '@/lib/reading/activity';
const mocks = vi.hoisted(() => ({ online: true, owner: 'owner' as string | null }));
vi.mock('@/lib/hooks/useOfflineLibrary', () => ({ useOfflineLibrary: () => ({ isOnline: mocks.online }) }));
vi.mock('@/lib/offline/owner', () => ({ useCacheOwner: () => mocks.owner }));
import ActivityPage from '@/app/activity/page';
const sessions: ActivitySession[] = [{ id: 'session', baselinePage: 224, finishedAt: '2026-01-10T15:00:00Z', book: { id: 'book', title: 'A Recorded Novel', author: { name: 'An Author' } }, logs: [{ id: 'log', page: 300, occurredAt: '2026-01-10T15:00:00Z', createdAt: '2026-01-10T15:00:00Z' }] }, { id: 'old', baselinePage: 0, finishedAt: '2025-07-10T15:00:00Z', book: { id: 'old-book', title: 'Last Year’s Novel', author: { name: 'An Author' } }, logs: [] }];
const result = (year = 2026, input = sessions) => buildReadingActivity(input, year, 'UTC', 155, new Date('2026-11-19T12:00:00Z'));
beforeEach(() => { mocks.online = true; mocks.owner = 'owner'; vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => result(Number(new URL(url, 'http://localhost').searchParams.get('year') ?? 2026)) }))); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('reading activity page', () => {
  it('shows an honest empty state and separates imported Read labels from dated completions', async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => result(2026, []) } as Response);
    render(<ActivityPage />); await screen.findByText('Your 2026 story starts with a reading log');
    expect(screen.getByText('155 Read books have no recorded finish date.')).toBeDefined();
    expect(screen.getByRole('region', { name: 'Yearly reading totals' }).textContent).toContain('Books finished0');
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(12);
  });
  it('lets users inspect monthly completions and quarterly insights with book links and dates', async () => {
    render(<ActivityPage />); await screen.findByLabelText('Activity year');
    fireEvent.click(screen.getByRole('button', { name: 'View all finished books in 2026' }));
    expect(screen.getByRole('link', { name: 'A Recorded Novel' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Hide all finished books in 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'January: 76 pages logged, 1 books finished' }));
    expect(screen.getByRole('link', { name: 'A Recorded Novel' }).getAttribute('href')).toBe('/library/book/book');
    fireEvent.change(screen.getByLabelText('Recap quarter'), { target: { value: '1' } });
    const recap = screen.getByRole('region', { name: 'Q1 2026' });
    expect(within(recap).getByText('January had the most logged pages this quarter (76).')).toBeDefined();
    expect(within(recap).getByRole('link', { name: 'A Recorded Novel' })).toBeDefined();
    expect(within(recap).getByRole('time').getAttribute('datetime')).toBe('2026-01-10T15:00:00Z');
  });
  it('loads another year, resets month/quarter selection and uses private uncached requests', async () => {
    render(<ActivityPage />); await screen.findByLabelText('Activity year');
    fireEvent.change(screen.getByLabelText('Activity year'), { target: { value: '2025' } });
    await screen.findByRole('link', { name: 'Last Year’s Novel' });
    expect(screen.getByRole('region', { name: 'Q3 2025' })).toBeDefined();
    expect(vi.mocked(fetch).mock.calls.some(([url, init]) => String(url).includes('year=2025') && init?.cache === 'no-store')).toBe(true);
  });
  it('reports fetch errors and supports retry', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false, json: async () => ({ message: 'Activity unavailable.' }) } as Response);
    render(<ActivityPage />); await screen.findByText('Activity unavailable.');
    fireEvent.click(screen.getByRole('button', { name: 'Retry activity' }));
    await screen.findByLabelText('Activity year'); expect(screen.queryByRole('alert')).toBeNull();
  });
  it('does not fetch offline and reconnects without inventing cached totals', async () => {
    mocks.online = false; const { rerender } = render(<ActivityPage />);
    await screen.findByText('Reading activity needs a connection'); expect(fetch).not.toHaveBeenCalled();
    mocks.online = true; rerender(<ActivityPage />); await screen.findByLabelText('Activity year');
  });
  it('clears displayed private activity when the authenticated account disappears', async () => {
    const { rerender } = render(<ActivityPage />); await screen.findByLabelText('Activity year');
    mocks.owner = null; rerender(<ActivityPage />);
    await waitFor(() => expect(screen.queryByLabelText('Activity year')).toBeNull());
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeDefined();
  });
});
