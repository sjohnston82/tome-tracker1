import { describe, expect, it } from 'vitest'
import { groupAuthors } from '@/lib/books/author-groups'
describe('alphabetical author sections', () => {
  it('groups by surname, handles shared surnames and accents, and puts symbols under #', () => {
    const authors = ['Terry Pratchett', 'Arkady & Boris Strugatsky', 'Larry Niven & Arthur C. Clarke', 'John Érard', '123'].map(name => ({ name }))
    expect(groupAuthors(authors).map(group => [group.letter, group.authors.map(author => author.name)])).toEqual([
      ['#', ['123']], ['C', ['Larry Niven & Arthur C. Clarke']], ['E', ['John Érard']], ['P', ['Terry Pratchett']], ['S', ['Arkady & Boris Strugatsky']],
    ])
    expect(authors[0].name).toBe('Terry Pratchett')
  })
  it('sorts authors within their sections and omits empty sections after filtering', () => {
    const authors = [{ name: 'Susanna Clarke' }, { name: 'Arthur C. Clarke' }, { name: 'Michael Crichton' }]
    const groups = groupAuthors(authors)
    expect(groups).toHaveLength(1)
    expect(groups[0].authors.map(author => author.name)).toEqual(['Arthur C. Clarke', 'Susanna Clarke', 'Michael Crichton'])
    expect(groupAuthors([])).toEqual([])
  })
})
