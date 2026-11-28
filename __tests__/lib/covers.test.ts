import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findBookCover } from '@/lib/metadata/covers'
import { coverTitleMatches } from '@/lib/metadata/cover-title'
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

  it('matches split-edition subtitles and Roman part numbers without selecting the work jacket or Part II', async () => {
    mock([{ title: 'The Reality Dysfunction', author_name: ['Peter F. Hamilton'], cover_i: 1000595, editions: { docs: [
      { title: 'The Reality Dysfunction Part II', subtitle: 'Expansion', language: ['eng'], cover_i: 2 },
      { title: 'The Reality Dysfunction Part I', subtitle: 'Emergence', language: ['eng'], cover_i: 286907 },
    ] } }]);
    expect(await findBookCover('The Reality Dysfunction, Part 1: Emergence', 'Peter F. Hamilton')).toContain('/286907-L.jpg');
    expect(new URL(vi.mocked(fetch).mock.calls[0][0] as string).searchParams.get('fields')).toContain('editions.subtitle');
    mock([{ title: 'The Reality Dysfunction', author_name: ['Peter F. Hamilton'], cover_i: 1000595 }]);
    expect(await findBookCover('The Reality Dysfunction, Part 1: Emergence', 'Peter F. Hamilton')).toBeNull();
  });
  it('checks physical edition titles when expanding a parent work', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('/editions.json') ? { entries: [
      { title: 'The Reality Dysfunction', covers: [1], languages: [{ key: '/languages/eng' }] },
      { title: 'The Reality Dysfunction Part II', subtitle: 'Expansion', covers: [2], languages: [{ key: '/languages/eng' }] },
      { title: 'The Reality Dysfunction Part I', subtitle: 'Emergence', covers: [3], languages: [{ key: '/languages/ger' }] },
      { title: 'The Reality Dysfunction Part I', subtitle: 'Emergence', covers: [42], languages: [{ key: '/languages/eng' }] },
    ] } : { docs: [{ key: '/works/OL474017W', title: 'The Reality Dysfunction', author_name: ['Peter F. Hamilton'], cover_i: 1, editions: { docs: [] } }] } }));
    vi.stubGlobal('fetch', fetcher);
    expect(await findBookCover('The Reality Dysfunction, Part 1: Emergence', 'Peter F. Hamilton')).toContain('/42-L.jpg');
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('/editions.json') ? { entries: [
      { title: 'The Reality Dysfunction Part II', subtitle: 'Expansion', covers: [2], languages: [{ key: '/languages/eng' }] },
      { covers: [3], languages: [{ key: '/languages/eng' }] },
    ] } : { docs: [{ key: '/works/OL474017W', title: 'The Reality Dysfunction', author_name: ['Peter F. Hamilton'], cover_i: 1, editions: { docs: [] } }] } })));
    expect(await findBookCover('The Reality Dysfunction, Part 1: Emergence', 'Peter F. Hamilton')).toBeNull();
  });
  it('combines Google subtitles while rejecting other physical parts and authors', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'test-key');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [
      { volumeInfo: { title: 'The Reality Dysfunction', authors: ['Peter F. Hamilton'], language: 'en', imageLinks: { thumbnail: 'https://books.google.com/books/content?id=whole' } } },
      { volumeInfo: { title: 'The Reality Dysfunction Part II', subtitle: 'Expansion', authors: ['Peter F. Hamilton'], language: 'en', imageLinks: { thumbnail: 'https://books.google.com/books/content?id=wrong-part' } } },
      { volumeInfo: { title: 'The Reality Dysfunction Part I', subtitle: 'Emergence', authors: ['Someone Else'], language: 'en', imageLinks: { thumbnail: 'https://books.google.com/books/content?id=wrong-author' } } },
      { volumeInfo: { title: 'The Reality Dysfunction Part I', subtitle: 'Emergence', authors: ['Peter F. Hamilton'], language: 'en', imageLinks: { thumbnail: 'https://books.google.com/books/content?id=correct' } } },
    ] }) });
    vi.stubGlobal('fetch', fetcher);
    expect(await findBookCover('The Reality Dysfunction, Part 1: Emergence', 'Peter F. Hamilton')).toContain('id=correct');
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('q')).toBe('intitle:"Reality Dysfunction" inauthor:"Peter F. Hamilton"');
  });
  it('normalizes only explicit part/volume numbering and preserves subtitle conflicts', () => {
    expect(coverTitleMatches('Novel, Part 1: Emergence', 'Novel Part I', 'Emergence')).toBe(true);
    expect(coverTitleMatches('Novel Volume 2', 'Novel Vol. II')).toBe(true);
    expect(coverTitleMatches('I, Robot', '1 Robot')).toBe(false);
    expect(coverTitleMatches('Novel Part 1: Emergence', 'Novel Part II', 'Emergence')).toBe(false);
    expect(coverTitleMatches('Novel Part 1: Emergence', 'Novel Part I', 'Expansion')).toBe(false);
    expect(coverTitleMatches('Novel Part 1', 'Novel Book I')).toBe(false);
  });

  it('matches Van Loon’s Geography when the provider stores its subtitle separately', async () => {
    const title = "Van Loon's Geography: The Story of the World";
    const author = 'Hendrik Willem van Loon';
    mock([{ title: "Van Loon's geography", author_name: ['Hendrik Willem Van Loon'], cover_i: 6572958,
      editions: { docs: [{ title: "Van Loon's geography", subtitle: 'the story of the world.', cover_i: 9438377, language: ['eng'] }] } }]);
    expect(await findBookCover(title, author)).toContain('/9438377-L.jpg');
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ volumeInfo: {
      title: "Van Loon's Geography", subtitle: 'The Story of the World', authors: ['Hendrik Willem Van Loon'], language: 'en',
      imageLinks: { thumbnail: 'https://books.google.com/books/content?id=geography' },
    } }] }) }));
    expect(await findBookCover(title, author)).toContain('id=geography');
  });

})
