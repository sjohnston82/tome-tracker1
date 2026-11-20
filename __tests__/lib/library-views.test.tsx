import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CacheOwnerProvider } from '@/lib/offline/owner';
import { PreferencesProvider } from '@/lib/preferences';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/hooks/useLibrary', () => ({ useLibrary: () => ({ loading: false, error: null, authors: [{ id: 'p', name: 'Terry Pratchett', books: [{ id: 'book', title: 'A Novel' }] }, { id: 'c', name: 'Arthur C. Clarke', books: [{ id: 'other-book', title: 'Space Novel' }] }], stats: { bookCount: 2, authorCount: 2 }, sync: vi.fn(), isFromCache: false }) }));
vi.mock('@/components/library/cover-enrichment', () => ({ CoverEnrichment: () => null }));
vi.mock('@/components/library/currently-reading', () => ({ CurrentlyReading: () => null }));
vi.mock('@/components/onboarding/onboarding-modal', () => ({ OnboardingModal: () => null }));
import LibraryPage from '@/app/library/page';
const view = (owner = 'owner') => <CacheOwnerProvider userId={owner}><PreferencesProvider><LibraryPage /></PreferencesProvider></CacheOwnerProvider>;
beforeEach(() => localStorage.clear()); afterEach(cleanup);
describe('library view switching', () => {
  it('switches between dropdowns and shelves and remembers the choice after remount', async () => {
    const { unmount } = render(view()); await waitFor(() => expect(screen.getByRole('button', { name: 'Book shelves' }).hasAttribute('disabled')).toBe(false));
    expect(screen.getByRole('button', { name: 'Author list' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.queryByRole('link', { name: /A Novel/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Book shelves' }));
    expect(screen.getByRole('list', { name: 'Books by Terry Pratchett' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Book shelves' }).getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('tome-preferences:owner')!).libraryView).toBe('shelves');
    unmount(); render(view()); await screen.findByRole('list', { name: 'Books by Terry Pratchett' });
    fireEvent.click(screen.getByRole('button', { name: 'Author list' })); expect(screen.queryByRole('list', { name: 'Books by Terry Pratchett' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Terry Pratchett/ })); expect(screen.getByRole('link', { name: /A Novel/ })).toBeDefined();
  });
  it('keeps author filtering and alphabet availability in shelf view and isolates the saved view by account', async () => {
    localStorage.setItem('tome-preferences:owner', JSON.stringify({ libraryView: 'shelves' }));
    const { rerender } = render(view()); await screen.findByRole('list', { name: 'Books by Terry Pratchett' });
    fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: 'Pratchett' } });
    expect(screen.queryByRole('heading', { name: 'Arthur C. Clarke' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Jump to C' }).hasAttribute('disabled')).toBe(true);
    rerender(view('other')); await waitFor(() => expect(screen.getByRole('button', { name: 'Author list' }).getAttribute('aria-pressed')).toBe('true'));
    expect(screen.queryByRole('list', { name: 'Books by Terry Pratchett' })).toBeNull();
  });
});
