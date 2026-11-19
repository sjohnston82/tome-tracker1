import { afterEach, describe, expect, it, vi } from 'vitest'
import { lookupPageCounts } from '@/lib/metadata/page-counts'
afterEach(() => vi.unstubAllGlobals())
const isbn = '9780000000001'
const google = (pages: number, id = isbn) => ({ items: [{ volumeInfo: { title: 'A Novel', authors: ['An Author'], pageCount: pages, industryIdentifiers: [{ identifier: id }] } }] })
const edition = (pages: number) => ({ title: 'A Novel', number_of_pages: pages, isbn_13: [isbn], publishers: ['Publisher'], publish_date: '2000' })
const mock = (handler: (url: string) => unknown) => vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200, json: async () => handler(url) })))
describe('edition page-count suggestions', () => {
  it('keeps pagination available after one edition source fails, and retries transient errors once', async () => {
    const fetcher = vi.fn(async (url: string) => ({ ok: !url.includes('OL1W/editions'), status: url.includes('OL1W/editions') ? 503 : 200, json: async () => url.includes('googleapis') ? { items: [] } : url.includes('search.json') ? { docs: [1, 2].map(id => ({ key: `/works/OL${id}W`, title: 'A Novel', author_name: ['An Author'] })) } : { entries: [edition(602)] } }))
    vi.stubGlobal('fetch', fetcher)
    vi.useFakeTimers()
    try {
      const pending = lookupPageCounts('A Novel', 'An Author', null, true)
      await vi.runAllTimersAsync()
      const result = await pending
      expect(result.incomplete).toBe(true)
      expect(result.nextOffset).toBe(30)
      expect(result.options.map(option => option.pages)).toEqual([602])
      expect(fetcher.mock.calls.filter(([url]) => url.includes('OL1W/editions'))).toHaveLength(2)
    } finally { vi.useRealTimers() }
  })
  it('uses provider next links or total size even when a batch has fewer than 30 rows', async () => {
    mock(url => url.includes('googleapis') ? { items: [] } : url.includes('search.json') ? { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'] }] } : { size: 100, links: { next: '/works/OL1W/editions.json?offset=30' }, entries: [edition(602)] })
    expect((await lookupPageCounts('A Novel', 'An Author', null, true)).nextOffset).toBe(30)
  })
  it('loads later edition batches rather than repeating the first results', async () => {
    mock(url => url.includes('googleapis') ? { items: [] } : url.includes('search.json') ? { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'] }] } : { entries: Array.from({ length: 30 }, (_, i) => ({ ...edition(608 + i), isbn_13: [`edition-${i}`] })) })
    const result = await lookupPageCounts('A Novel', 'An Author', null, true, 30)
    expect(result.options).toHaveLength(30)
    expect(result.nextOffset).toBe(60)
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('offset=30'))).toBe(true)
  })
  it('can explicitly browse other editions even when an exact ISBN count exists', async () => {
    mock(url => url.includes('googleapis') ? { items: [] } : url.includes('search.json') ? { docs: [{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'] }] } : url.includes('/editions') ? { entries: [{ ...edition(512), isbn_13: ['9780000000002'] }] } : edition(480))
    const result = await lookupPageCounts('A Novel', 'An Author', isbn, true)
    expect(result.options.map(option => option.pages)).toEqual([480, 512])
    expect(result.options[1].exactIsbn).toBe(false)
  })
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
