import { describe, expect, it } from 'vitest'
import { authorSortKey, compareAuthors, formatAuthorName } from '@/lib/books/author-sort'

describe('library author filing', () => {
  it('formats and sorts shared surnames without treating a given name as a surname', () => {
    for (const name of ['Arkady & Boris Strugatsky', 'Arkady and Boris Strugatsky', 'Arkady Strugatsky & Boris Strugatsky', 'Strugatsky, Arkady & Boris']) {
      expect(formatAuthorName(name)).toBe('Strugatsky, Arkady & Boris')
      expect(authorSortKey(name)).toBe('strugatsky')
    }
    expect(formatAuthorName('Larry Niven & Arthur C. Clarke')).toBe('Niven, Larry & Clarke, Arthur C.')
  })
  it('displays surnames first without changing stored credits', () => {
    expect(formatAuthorName('Arthur C. Clarke')).toBe('Clarke, Arthur C.')
    expect(formatAuthorName('Arthur C. Clarke & Larry Niven')).toBe('Clarke, Arthur C. & Niven, Larry')
    expect(formatAuthorName('L. E. Modesitt Jr.')).toBe('Modesitt, L. E. Jr.')
    expect(formatAuthorName('Clarke, Arthur C.')).toBe('Clarke, Arthur C.')
  })
  it('sorts by surname and files collaborations under the earliest surname', () => {
    expect(authorSortKey('Larry Niven and Arthur C. Clarke')).toBe('clarke')
    expect(authorSortKey('Arthur C. Clarke & Gentry Lee')).toBe('clarke')
    expect(authorSortKey('Clarke, Arthur C.')).toBe('clarke')
    expect(authorSortKey('L. E. Modesitt Jr.')).toBe('modesitt')
    expect([{ name: 'Terry Pratchett' }, { name: 'Steven Erikson' }, { name: 'Arthur C. Clarke' }].sort(compareAuthors).map(a => a.name)).toEqual(['Arthur C. Clarke', 'Steven Erikson', 'Terry Pratchett'])
  })
})
