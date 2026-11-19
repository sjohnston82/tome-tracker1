import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupPageCounts } from '@/lib/metadata/page-counts'
afterEach(() => vi.unstubAllGlobals())
const isbn = '9780000000001'
const google = (pages: number, id = isbn) => ({ items: [{ volumeInfo: { title: 'A Novel', authors: ['An Author'], pageCount: pages, industryIdentifiers: [{ identifier: id }] } }] })
const edition = (pages: number) => ({ title: 'A Novel', number_of_pages: pages, isbn_13: [isbn], publishers: ['Publisher'], publish_date: '2000' })
const mock = (handler: (url: string) => unknown) => vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => handler(url) })))
describe('edition page-count suggestions', () => {
  it('prefers consistent counts with verified ISBN identifiers', async () => {
    mock(url => url.includes('googleapis') ? google(480) : edition(480))
    const result = await lookupPageCounts('A Novel', 'An Author', isbn)
    expect(result.suggested).toBe(480)
    expect(result.options).toHaveLength(2)
    expect(result.options.every(option => option.exactIsbn)).toBe(true)
  })
  it('does not choose silently when ISBN sources disagree', async () => {
    mock(url => url.includes('googleapis') ? google(512) : edition(480))
    const result = await lookupPageCounts('A Novel', 'An Author', isbn)
    expect(result.suggested).toBeNull()
    expect(result.message).toContain('disagree')
    expect(result.options.map(option => option.pages)).toEqual([480, 512])
  })
  it('offers specific editions for confirmation without an ISBN; never a work-level median', async () => {
    mock(url => url.includes('googleapis') ? { items: [] } : url.includes('search.json') ? { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'], number_of_pages_median: 999 }] } : { entries: [edition(240), edition(320)] })
    const result = await lookupPageCounts('A Novel', 'An Author')
    expect(result.suggested).toBeNull()
    expect(result.options.map(option => option.pages)).toEqual([240, 320])
    expect(result.options.every(option => !option.exactIsbn)).toBe(true)
  })
  it('rejects wrong ISBNs, wrong authors, zero and invalid counts', async () => {
    mock(url => url.includes('googleapis') ? { items: [{ volumeInfo: { title: 'Wrong title', authors: ['Other Author'], pageCount: 300, industryIdentifiers: [{ identifier: '9780000000002' }] } }, ...google(0).items] } : url.includes('/isbn/') ? { ...edition(300), isbn_13: ['9780000000002'] } : { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['Other Author'] }] })
    const result = await lookupPageCounts('A Novel', 'An Author', isbn)
    expect(result.suggested).toBeNull()
    expect(result.options).toEqual([])
  })
  it('keeps a valid ISBN suggestion if the other provider is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: !url.includes('googleapis'), status: url.includes('googleapis') ? 429 : 200, json: async () => edition(480) })))
    const result = await lookupPageCounts('A Novel', 'An Author', isbn)
    expect(result.suggested).toBe(480)
    expect(result.warnings).toContainEqual(expect.stringContaining('Google Books'))
  })
})
