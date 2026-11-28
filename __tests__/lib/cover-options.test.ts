import { afterEach, describe, expect, it, vi } from 'vitest'
import { searchCoverOptions, isProviderCover } from '@/lib/metadata/cover-options'
afterEach(() => vi.unstubAllGlobals())
describe('alternative edition covers', () => {
  it('includes edition jackets, deduplicates and ranks an exact ISBN first', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('googleapis') ? { items: [{ volumeInfo: { title: 'A Novel', authors: ['An Author'], imageLinks: { thumbnail: 'http://books.google.com/books/content?id=42&zoom=1' } } }] } : url.includes('/search.json') ? { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'], cover_i: 1 }] } : url.includes('/editions') ? { entries: [{ title: 'A Novel', covers: [1, 2], isbn_13: ['9780000000001'], publishers: ['Publisher'], publish_date: '2000' }] } : { title: 'A Novel', covers: [2], isbn_13: ['9780000000001'] } })))
    const result = await searchCoverOptions('A Novel', 'An Author', '9780000000001')
    expect(result.options).toHaveLength(3)
    expect(result.options[0].exactIsbn).toBe(true)
    expect(result.options.some(option => option.source === 'Google Books' && option.url.startsWith('https:'))).toBe(true)
    expect(result.warnings).toEqual([])
  })
  it('returns usable partial results when one provider fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: !url.includes('googleapis'), json: async () => url.includes('/search') ? { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'], cover_i: 1 }] } : { entries: [] } })))
    const result = await searchCoverOptions('A Novel', 'An Author')
    expect(result.options).toHaveLength(1)
    expect(result.warnings).toContainEqual(expect.stringContaining('Google Books'))
  })
  it('does not accept arbitrary image URLs or provider work paths', async () => {
    expect(isProviderCover('https://covers.openlibrary.org/b/id/42-L.jpg')).toBe(true)
    expect(isProviderCover('https://example.com/cover.jpg')).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ docs: [{ key: '/admin/private', title: 'Unsafe', cover_i: 42 }] }) })))
    expect((await searchCoverOptions('Unsafe', '')).options).toEqual([])
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)
  })
  it('ranks exact ISBN first, then English covers, and retains foreign alternatives for manual choice', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, json: async () => url.includes('googleapis') ? { items: [] } : url.includes('/search') ? { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'], cover_i: 1 }] } : url.includes('/editions') ? { entries: [{ title: 'German edition', covers: [1], languages: [{ key: '/languages/ger' }] }, { title: 'English edition', covers: [2], languages: [{ key: '/languages/eng' }] }] } : { title: 'My German copy', covers: [3], isbn_13: ['9780000000001'], languages: [{ key: '/languages/ger' }] } })));
    const result = await searchCoverOptions('A Novel', 'An Author', '9780000000001');
    expect(result.options.map(option => option.url.match(/id\/(\d+)/)?.[1])).toEqual(['3', '2', '1']);
    expect(result.options.map(option => option.language)).toEqual(['de', 'en', 'de']);
    const googleURL = String(vi.mocked(fetch).mock.calls.find(([url]) => String(url).includes('googleapis'))![0]); expect(new URL(googleURL).searchParams.get('langRestrict')).toBe('en');
  });

})
