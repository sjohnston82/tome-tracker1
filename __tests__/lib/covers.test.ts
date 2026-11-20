import { afterEach, describe, expect, it, vi } from 'vitest'
import { findBookCover } from '@/lib/metadata/covers'
afterEach(() => vi.unstubAllGlobals())
const mock = (docs: unknown[]) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs }) }))
describe('conservative cover matching', () => {
  it('retries the British spelling when the provider finds no American spelling', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [] }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ docs: [{ title: 'The Colour of Magic', author_name: ['Terry Pratchett'], cover_i: 42 }] }) })
    vi.stubGlobal('fetch', fetcher)
    expect(await findBookCover('The Color of Magic', 'Terry Pratchett')).toContain('/42-L.jpg')
    expect(fetcher.mock.calls[1][0]).toContain('The+colour+of+Magic')
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
    expect(params.get('lang')).toBe('en'); expect(params.get('q')).toBe('A Novel'); expect(params.has('author')).toBe(false); expect(params.get('fields')).toContain('editions.language');
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

})
