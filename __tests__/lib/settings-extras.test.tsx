import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
const mocks = vi.hoisted(() => ({ refresh: vi.fn(), sync: vi.fn().mockResolvedValue(true) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock('@/lib/hooks/useOfflineLibrary', () => ({ useOfflineLibrary: () => ({ isOnline: true, syncAndCache: mocks.sync, cacheStats: { bookCount: 10, authorCount: 2, lastSync: null } }) }));
import { BackupSettings, SecuritySettings, DiagnosticsSettings } from '@/components/settings/settings-extras';
import { AuthorCard } from '@/components/library/author-card';
beforeEach(() => vi.clearAllMocks());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
describe('new settings interactions', () => {
  it('previews the selected backup and restores only after explicit confirmation', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: !url.endsWith('/backup'), json: async () => url.includes('preview') ? { summary: { books: 259, series: 71, works: 436, readingLogs: 3 } } : { message: 'Restore requires an empty library.' } }));
    vi.stubGlobal('fetch', fetcher); render(<BackupSettings />);
    fireEvent.click(screen.getByText('Restore a backup'));
    const file = new File(['{}'], 'backup.json', { type: 'application/json' }); Object.defineProperty(file, 'text', { value: async () => '{}' });
    fireEvent.change(screen.getByLabelText('Backup JSON'), { target: { files: [file] } });
    await screen.findByText(/259 owned books/);
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Confirm restore into empty library' }));
    await screen.findByText('Restore requires an empty library.');
    expect(mocks.sync).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm restore into empty library' }).hasAttribute('disabled')).toBe(false);
  });
  it('blocks mismatched passwords and handles server errors before a successful credential update', async () => {
    const fetcher = vi.fn(async (_url: string, init?: RequestInit): Promise<{ ok: boolean; json: () => Promise<Record<string, unknown>> }> => ({ ok: !init || init.method !== 'PATCH', json: async () => init?.method === 'PATCH' ? { message: 'Current password is incorrect.' } : { user: { email: 'owner@example.test' } } }));
    vi.stubGlobal('fetch', fetcher); render(<SecuritySettings />);
    await screen.findByText('Signed in as owner@example.test');
    fireEvent.change(screen.getByLabelText('New password (optional)'), { target: { value: 'NewPassword123!' } });
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'OldPassword123!' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save account changes' }).closest('form')!);
    await screen.findByText('New passwords do not match.'); expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewPassword123!' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Save account changes' }).closest('form')!);
    await screen.findByText('Current password is incorrect.');
    fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ email: 'owner@example.test' }) });
    fireEvent.submit(screen.getByRole('button', { name: 'Save account changes' }).closest('form')!);
    await screen.findByText('Account details updated.');
    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe(''); expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it('shows privacy-safe diagnostics when the clipboard is unavailable', async () => {
    render(<DiagnosticsSettings />); fireEvent.click(screen.getByRole('button', { name: 'Copy troubleshooting details' }));
    await screen.findByText('Clipboard unavailable. Copy the details below.');
    const value = (screen.getByLabelText('Troubleshooting details') as HTMLTextAreaElement).value;
    expect(JSON.parse(value)).toMatchObject({ cachedBooks: 10, connection: 'online' }); expect(value).not.toContain('email'); expect(value).not.toContain('password');
  });
  it('expands authors by default and orders books by the configured choice', () => {
    const author = { id: 'a', name: 'An Author', books: [{ id: '1', title: 'Z title', publicationYear: 1952 }, { id: '2', title: 'A title', publicationYear: 2000 }] };
    const { rerender } = render(<AuthorCard author={author} groupBySeries={false} defaultExpanded bookSort="title" />);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('link').map(link => link.querySelector('p')?.textContent)).toEqual(['A title', 'Z title']);
    rerender(<AuthorCard author={author} groupBySeries={false} defaultExpanded bookSort="year" />);
    expect(screen.getAllByRole('link').map(link => link.querySelector('p')?.textContent)).toEqual(['Z title', 'A title']);
  });
});
