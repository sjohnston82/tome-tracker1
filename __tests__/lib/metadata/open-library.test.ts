import { describe, it, expect, vi, afterEach } from 'vitest'
import { openLibrary } from '@/lib/metadata/open-library'

afterEach(() => vi.unstubAllGlobals())

describe('OpenLibrary Provider', () => {
  it('maps edition metadata and resolves author references', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ title: 'The Way of Kings', authors: [{ key: '/authors/OL1A' }], publish_date: 'August 2010', covers: [123], publishers: ['Tor'] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'Brandon Sanderson' }) })
    vi.stubGlobal('fetch', fetcher)
    expect(await openLibrary.lookupByIsbn('9780765326355')).toMatchObject({ title: 'The Way of Kings', authors: ['Brandon Sanderson'], publishedYear: 2010, publisher: 'Tor', isbn13: '9780765326355' })
    expect(fetcher.mock.calls[1][0]).toBe('https://openlibrary.org/authors/OL1A.json')
  })

  it('returns null for a missing edition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    expect(await openLibrary.lookupByIsbn('9780765326355')).toBeNull()
  })

  it('keeps edition metadata when author lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ title: 'Unknown author', authors: [{ key: '/authors/OL1A' }] }) })
      .mockRejectedValueOnce(new Error('network failure')))
    expect(await openLibrary.lookupByIsbn('9780765326355')).toMatchObject({ title: 'Unknown author', authors: [] })
  })

  it('maps search results without inventing missing publication metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [{ title: 'Mistborn', author_name: ['Brandon Sanderson'], isbn: ['076531178X', '9780765311788'] }, { title: 'Untitled' }] }) }))
    const results = await openLibrary.search('mistborn sanderson')
    expect(results[0]).toMatchObject({ title: 'Mistborn', authors: ['Brandon Sanderson'] })
    expect(results[0].isbn13).toBeUndefined() // A work-level ISBN list doesn't identify the displayed edition.
    expect(results[1].publishedYear).toBeUndefined()
    expect(results[1].authors).toEqual([])
  })
  it('uses an English edition’s cover, title and ISBN together instead of a random work-level ISBN', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [{ title: 'Mistborn', author_name: ['Brandon Sanderson'], isbn: ['9780000000001'], cover_i: 1, editions: { docs: [{ title: 'Mistborn', cover_i: 2, language: ['eng'], isbn: ['9780765311788'] }] } }] }) });
    vi.stubGlobal('fetch', fetcher);
    expect((await openLibrary.search('Mistborn'))[0]).toMatchObject({ coverUrl: 'https://covers.openlibrary.org/b/id/2-M.jpg', isbn13: '9780765311788' });
    expect(new URL(fetcher.mock.calls[0][0]).searchParams.get('lang')).toBe('en');
  });

})
