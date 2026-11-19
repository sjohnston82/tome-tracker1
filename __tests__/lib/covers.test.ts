import { afterEach, describe, expect, it, vi } from 'vitest'
import { findBookCover } from '@/lib/metadata/covers'
afterEach(() => vi.unstubAllGlobals())
const mock = (docs: unknown[]) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs }) }))
describe('conservative cover matching', () => {
  it('matches title and every coauthor, including punctuation variants', async () => {
    mock([{ title: 'A Novel', author_name: ['Arthur C Clarke', 'Larry Niven'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'Larry Niven & Arthur C. Clarke')).toContain('/42-L.jpg')
  })
  it('does not attach a cover for another author, title or ambiguous result', async () => {
    mock([{ title: 'A Novel', author_name: ['Someone Else'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'An Author')).toBeNull()
    mock([{ title: 'Another Novel', author_name: ['An Author'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'An Author')).toBeNull()
    mock([1, 2].map(cover_i => ({ title: 'A Novel', author_name: ['An Author'], cover_i })))
    expect(await findBookCover('A Novel', 'An Author')).toBeNull()
  })
  it('requires the exact ISBN and tolerates provider failures', async () => {
    mock([{ title: 'A Novel', isbn: ['9780000000001'], cover_i: 42 }])
    expect(await findBookCover('A Novel', 'An Author', '9780000000002')).toBeNull()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Offline')))
    expect(await findBookCover('A Novel', 'An Author')).toBeNull()
  })
})
