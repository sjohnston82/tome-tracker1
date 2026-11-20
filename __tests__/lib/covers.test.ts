import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findBookCover } from '@/lib/metadata/covers'
beforeEach(() => vi.stubEnv('GOOGLE_BOOKS_API_KEY', ''))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); })
const mock = (docs: unknown[]) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs }) }))
describe('conservative cover matching', () => {
  it('retries the British spelling when the provider finds no American spelling', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [{ title: 'The Colour of Magic', author_name: ['Terry Pratchett'], cover_i: 42 }] }) })
    vi.stubGlobal('fetch', fetcher)
    expect(await findBookCover('The Color of Magic', 'Terry Pratchett')).toContain('/42-L.jpg')
    expect(fetcher.mock.calls[1][0]).toContain('colour+of+Magic')
  })
  it('handles real provider middle-name omissions and ignores individual invalid cover records', async () => {
    mock([{ title: 'Consider Phlebas', author_name: ['Iain Banks'], cover_i: -1 }, { title: 'Consider Phlebas', author_name: ['Iain Banks'], cover_i: 1009644 }])
    expect(await findBookCover('Consider Phlebas', 'Iain M. Banks')).toContain('/1009644-L.jpg')
    mock([{ title: 'A Novel', author_name: ['Michael Smith'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'Mark Smith')).toBeNull()
  })
  it('matches title and every coauthor, including punctuation variants', async () => {
    mock([{ title: 'A Novel', author_name: ['Arthur C Clarke', 'Larry Niven'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'Larry Niven & Arthur C. Clarke')).toContain('/42-L.jpg')
  })
  it('rejects wrong titles/authors but accepts multiple editions of the same work', async () => {
    mock([{ title: 'A Novel', author_name: ['Someone Else'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'An Author')).toBeNull()
    mock([{ title: 'Another Novel', author_name: ['An Author'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'An Author')).toBeNull()
    mock([1, 2].map(cover_i => ({ title: 'A Novel', author_name: ['An Author'], cover_i })))
    expect(await findBookCover('A Novel', 'An Author')).toContain('/1-L.jpg')
  })
  it('requires the exact ISBN and tolerates provider failures', async () => {
    mock([{ title: 'A Novel', isbn: ['9780000000001'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'An Author', '9780000000002')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))
    expect(await findBookCover('A Novel', 'An Author')).toBeNull()
  })
  it('selects the English edition cover instead of the work’s first German jacket', async () => {
    mock([{ title: 'A Novel', author_name: ['An Author'], cover_i: 1, language: ['eng', 'ger'], editions: { docs: [{ title: 'A Novel', language: ['eng'], cover_i: 42 }] } }]);
    expect(await findBookCover('A Novel', 'An Author')).toContain('/42-L.jpg');
    const params = new URL(vi.mocked(fetch).mock.calls[0][0] as string).searchParams;
    expect(params.get('lang')).toBe('en'); expect(params.get('q')).toBe('Novel'); expect(params.has('author')).toBe(false); expect(params.get('fields')).toContain('editions.language');
  });
  it('ranks confirmed English above unknown artwork and avoids known foreign-language editions', async () => {
    mock([{ title: 'A Novel', author_name: ['An Author'], cover_i: 1 }, { title: 'A Novel', author_name: ['An Author'], cover_i: 2, editions: { docs: [{ language: ['eng'], cover_i: 42 }] } }]);
    expect(await findBookCover('A Novel', 'An Author')).toContain('/42-L.jpg');
    mock([{ title: 'A Novel', author_name: ['An Author'], cover_i: 1, language: ['eng', 'ger'], editions: { docs: [{ language: ['ger'], cover_i: 1 }] } }]);
    expect(await findBookCover('A Novel', 'An Author')).toBeNull();
    mock([{ title: 'A Novel', author_name: ['An Author'], cover_i: 1, editions: { docs: [] } }]);
    expect(await findBookCover('A Novel', 'An Author')).toBeNull();
  });
  it('uses a verified ISBN edition even if it is not English, never a generic work cover', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ isbn_13: ['9780000000001'], covers: [7], languages: [{ key: '/languages/ger' }] }) }));
    expect(await findBookCover('A Novel', 'An Author', '9780000000001')).toContain('/7-L.jpg');
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('https://openlibrary.org/isbn/9780000000001.json');
    expect(await findBookCover('A Novel', 'An Author', '9780000000002')).toBeNull();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({ isbn_10: ['0306406152'], covers: [8] }) } as Response);
    expect(await findBookCover('A Novel', 'An Author', '9780306406157')).toContain('/8-L.jpg');
  });

  it('uses the configured Google key for a fast, verified English cover and ignores a source article/suffix mismatch', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'test-key');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ volumeInfo: { title: "Cadmian's Choice", authors: ['L. E. Modesitt'], language: 'en', imageLinks: { thumbnail: 'http://books.google.com/books/content?id=english&zoom=1' } } }] }) });
    vi.stubGlobal('fetch', fetcher);
    expect(await findBookCover("The Cadmian's Choice", 'L. E. Modesitt Jr.', null, true)).toContain('https://books.google.com/books/content');
    expect(fetcher).toHaveBeenCalledTimes(1); const params = new URL(fetcher.mock.calls[0][0]).searchParams;
    expect(params.get('key')).toBe('test-key'); expect(params.get('langRestrict')).toBe('en'); expect(params.get('q')).toContain('intitle:"Cadmian');
  });
  it('enumerates a matched work’s English editions when search expansion supplies no usable cover', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', '');
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('/editions.json') ? { entries: [{ covers: [1], languages: [{ key: '/languages/ger' }] }, { covers: [42], languages: [{ key: '/languages/eng' }] }] } : { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'], cover_i: 1, editions: { docs: [] } }] } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await findBookCover('A Novel', 'An Author')).toContain('/42-L.jpg'); expect(fetcher.mock.calls[1][0]).toBe('https://openlibrary.org/works/OL1W/editions.json?limit=100');
  });
  it('accepts a real-world six-second response instead of aborting at the previous 4.5-second cutoff', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', ''); vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(milliseconds => { const controller = new AbortController(); setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), milliseconds); return controller.signal; });
    vi.stubGlobal('fetch', vi.fn((_url: string, options: RequestInit) => new Promise((resolve, reject) => { setTimeout(() => resolve({ ok: true, json: async () => ({ docs: [{ title: 'A Novel', author_name: ['An Author'], editions: { docs: [{ cover_i: 42, language: ['eng'] }] } }] }) }), 6000); options.signal?.addEventListener('abort', () => reject(options.signal?.reason)); })));
    const assertion = expect(findBookCover('A Novel', 'An Author', null, true)).resolves.toContain('/42-L.jpg');
    await vi.advanceTimersByTimeAsync(6000); await assertion;
  });
  it('falls back to Open Library when Google returns a foreign edition or fails, and preserves real failure reporting', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('googleapis') ? { items: [{ volumeInfo: { title: 'A Novel', authors: ['An Author'], language: 'de', imageLinks: { thumbnail: 'https://books.google.com/books/content?id=foreign' } } }] } : { docs: [{ title: 'A Novel', author_name: ['An Author'], editions: { docs: [{ cover_i: 42, language: ['eng'] }] } }] } })));
    expect(await findBookCover('A Novel', 'An Author', null, true)).toContain('/42-L.jpg');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }));
    await expect(findBookCover('A Novel', 'An Author', null, true)).rejects.toThrow('HTTP 503');
    expect(await findBookCover('A Novel', 'An Author')).toBeNull();
  });

})
