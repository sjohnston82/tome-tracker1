import { describe, expect, it } from 'vitest'
import { authorSortKey, compareAuthors } from '@/lib/books/author-sort'

describe('library author filing', () => {
  it('sorts by surname and files collaborations under the earliest surname', () => {
    expect(authorSortKey('Larry Niven and Arthur C. Clarke')).toBe('clarke')
    expect(authorSortKey('Arthur C. Clarke & Gentry Lee')).toBe('clarke')
    expect(authorSortKey('Clarke, Arthur C.')).toBe('clarke')
    expect(authorSortKey('L. E. Modesitt Jr.')).toBe('modesitt')
    expect([{ name: 'Terry Pratchett' }, { name: 'Steven Erikson' }, { name: 'Arthur C. Clarke' }].sort(compareAuthors).map(a => a.name)).toEqual(['Arthur C. Clarke', 'Steven Erikson', 'Terry Pratchett'])
  })
})
