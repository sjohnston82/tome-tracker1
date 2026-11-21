import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, act, waitFor } from '@testing-library/react'
import { ReferenceCover } from '@/components/series/reference-cover'
import { CacheOwnerProvider } from '@/lib/offline/owner'
import { PreferencesProvider } from '@/lib/preferences'
import type { ReactNode } from 'react'
function Owner({ userId, children }: { userId: string; children: ReactNode }) { return <CacheOwnerProvider userId={userId}><PreferencesProvider>{children}</PreferencesProvider></CacheOwnerProvider> }
vi.mock('@/components/library/book-cover', () => ({ BookCover: ({ url, title }: { url: string | null; title: string }) => <div role="img" aria-label={title} data-url={url ?? ''} /> }))
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })
describe('lazy series reference artwork', () => {
  it('honors automatic-cover settings before issuing any lookup', async () => {
    localStorage.setItem('tome-preferences:disabled-owner', JSON.stringify({ autoCovers: false }))
    vi.stubGlobal('IntersectionObserver', undefined)
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    render(<Owner userId="disabled-owner"><ReferenceCover workId="disabled-work" title="Disabled" author="Author" savedUrl={null} allowReference /></Owner>)
    await act(async () => {})
    expect(fetcher).not.toHaveBeenCalled()
  })
  it('waits until a shelf is nearby and never replaces an explicitly removed cover', async () => {
    let visible: IntersectionObserverCallback = () => {}
    vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { visible = callback } observe() {} disconnect() {} })
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' }) })
    vi.stubGlobal('fetch', fetcher)
    const view = render(<Owner userId="lazy-owner"><ReferenceCover workId="lazy-work" title="Lazy book" author="Author" savedUrl={null} allowReference /></Owner>)
    expect(fetcher).not.toHaveBeenCalled()
    act(() => visible([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver))
    await waitFor(() => expect(screen.getByRole('img').getAttribute('data-url')).toContain('42'))
    view.rerender(<Owner userId="lazy-owner"><ReferenceCover workId="lazy-work" title="Lazy book" author="Author" savedUrl={null} allowReference={false} /></Owner>)
    expect(screen.getByRole('img').getAttribute('data-url')).toBe('')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('limits simultaneous lookups to two and shares artwork for overlapping series', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const resolve: (() => void)[] = []
    const fetcher = vi.fn(() => new Promise(done => resolve.push(() => done({ ok: true, json: async () => ({ coverUrl: 'https://covers.openlibrary.org/b/id/43-L.jpg' }) }))))
    vi.stubGlobal('fetch', fetcher)
    render(<Owner userId="queue-owner">{['one', 'two', 'three', 'one'].map((id, index) => <ReferenceCover key={index} workId={id} title={id} author="Author" savedUrl={null} allowReference />)}</Owner>)
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    await act(async () => { resolve[0]() })
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3))
    await act(async () => { resolve[1](); resolve[2]() })
    await waitFor(() => expect(screen.getAllByRole('img').every(image => image.getAttribute('data-url')?.includes('43'))).toBe(true))
  })
  it('does not reuse another account’s in-memory artwork', async () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ coverUrl: 'https://covers.openlibrary.org/b/id/44-L.jpg' }) })
    vi.stubGlobal('fetch', fetcher)
    const view = render(<Owner userId="account-a"><ReferenceCover workId="same-id" title="Shared" author="Author" savedUrl={null} allowReference /></Owner>)
    await waitFor(() => expect(screen.getByRole('img').getAttribute('data-url')).toContain('44'))
    fetcher.mockResolvedValue({ ok: false })
    view.rerender(<Owner userId="account-b"><ReferenceCover workId="same-id" title="Shared" author="Author" savedUrl={null} allowReference /></Owner>)
    expect(screen.getByRole('img').getAttribute('data-url')).toBe('')
    await screen.findByText('Cover unavailable')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
