import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CacheOwnerProvider } from '@/lib/offline/owner';
import { PreferencesProvider, usePreferences, parsePreferences } from '@/lib/preferences';
import { PreferenceSettings } from '@/components/settings/settings-extras';
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
function Probe() { const { preferences } = usePreferences(); return <output>{JSON.stringify(preferences)}</output>; }
const view = (owner: string) => <CacheOwnerProvider userId={owner}><PreferencesProvider><PreferenceSettings /><Probe /></PreferencesProvider></CacheOwnerProvider>;
beforeEach(() => localStorage.clear());
afterEach(() => cleanup());
describe('browser preferences', () => {
  it('persists all library/reading/accessibility choices and applies text/motion globally', async () => {
    const { unmount } = render(view('owner'));
    await waitFor(() => expect(screen.getByLabelText('Text size').hasAttribute('disabled')).toBe(false));
    fireEvent.change(screen.getByLabelText('Text size'), { target: { value: 'larger' } });
    fireEvent.change(screen.getByLabelText('Book order within each author'), { target: { value: 'title' } });
    fireEvent.change(screen.getByLabelText('Default progress entry'), { target: { value: 'percent' } });
    for (const name of ['Show series details by default', 'Start with author sections expanded', 'Reduce animations and smooth scrolling', 'Automatically find missing covers', 'Show Currently Reading at the top of the library']) fireEvent.click(screen.getByLabelText(name));
    expect(document.documentElement.dataset.textSize).toBe('larger');
    expect(document.documentElement.classList.contains('reduce-motion')).toBe(true);
    unmount(); render(view('owner'));
    await waitFor(() => expect((screen.getByLabelText('Text size') as HTMLSelectElement).value).toBe('larger'));
    expect(screen.getByRole('status').textContent).toContain('"autoCovers":false');
    expect(screen.getByRole('status').textContent).toContain('"progressUnit":"percent"');
  });
  it('isolates preferences between accounts and falls back from invalid values', async () => {
    localStorage.setItem('tome-preferences:owner', JSON.stringify({ textSize: 'large', autoCovers: false }));
    const { rerender } = render(view('owner'));
    await waitFor(() => expect((screen.getByLabelText('Text size') as HTMLSelectElement).value).toBe('large'));
    rerender(view('other'));
    await waitFor(() => expect((screen.getByLabelText('Text size') as HTMLSelectElement).value).toBe('standard'));
    expect(parsePreferences({ textSize: 'gigantic', autoCovers: 'false' }).autoCovers).toBe(true);
  });
  it('reports blocked storage while keeping controls usable', async () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked'); });
    render(view('owner'));
    fireEvent.change(screen.getByLabelText('Text size'), { target: { value: 'large' } });
    await screen.findByRole('alert');
    expect(document.documentElement.dataset.textSize).toBe('large');
    spy.mockRestore();
  });
});
