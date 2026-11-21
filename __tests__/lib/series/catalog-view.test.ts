import { describe, it, expect } from 'vitest'
import { reconcileCatalog, canonicalSeriesName, type CatalogBook } from '@/lib/series/catalog-view'
import type { ChecklistEntry, ChecklistSeries } from '@/lib/series/checklist'
const entry = (id: string, title: string, authorName = 'Steven Erikson'): ChecklistEntry => ({ id, position: null, entryType: 'MAIN', isConfirmed: false, work: { id, title, authorName, publicationYear: null, editions: [], containedIn: [] } })
const series = (id: string, name: string, entries: ChecklistEntry[]): ChecklistSeries => ({ id, name, entries, description: null })
const book = (id: string, title: string, name = 'Robert Jordan'): CatalogBook => ({ id, title, author: { name }, readingStatus: 'READING', isbn13: null, coverUrl: 'saved-cover', coverLocked: true, workId: null, contents: [] })
describe('non-destructive series reconciliation', () => {
  it('combines aliases under the requested canonical name and preserves original edit targets', () => {
    const one = entry('one', 'No Life Forsaken'); one.position = '2'
    const two = entry('two', 'No Life Forsaken'); two.work.editions = [book('owned', 'No Life Forsaken', 'Steven Erikson')]
    const input = [series('witness', 'Witness', [two]), series('tales', 'Tales of Witness', [one])]
    const snapshot = JSON.stringify(input)
    const output = reconcileCatalog(input, [])
    expect(output).toHaveLength(1)
    expect(output[0]).toMatchObject({ id: 'tales', name: 'Tales of Witness', entries: [{ id: 'one', seriesId: 'tales', position: '2' }] })
    expect(output[0].entries[0].work.editions[0].id).toBe('owned')
    expect(JSON.stringify(input)).toBe(snapshot)
    expect(reconcileCatalog(output, [])).toEqual(output)
    expect(canonicalSeriesName('Baucherlain and Korbal Broach', 'Steven Erikson')).toBe('Bauchelain & Korbal Broach')
    expect(canonicalSeriesName('Witness', 'Another Author')).toBe('Witness')
  })
  it('retains entries unique to an alias, targeting that alias when edited', () => {
    const output = reconcileCatalog([series('one', 'Bauchelain & Korbal Broach', [entry('first', 'Blood Follows')]), series('two', 'Bauchelain and Korbal Broach', [entry('second', 'The Wurms of Blearmouth')])], [])
    expect(output[0].entries.map(item => item.seriesId)).toEqual(['one', 'two'])
  })
  it('matches New Spring to the unlinked owned edition without changing its title, cover or reading status', () => {
    const owned = book('owned', 'The New Spring')
    const output = reconcileCatalog([series('wheel', 'The Wheel of Time', [entry('spring', 'New Spring', 'Robert Jordan')])], [owned])
    expect(output[0].entries[0].work.editions).toEqual([owned])
    expect(owned).toMatchObject({ title: 'The New Spring', readingStatus: 'READING', coverLocked: true, workId: null })
    expect(reconcileCatalog(output, [owned])).toEqual(output)
  })
  it('never guesses across authors, parts, existing links or ambiguous work identities', () => {
    const catalog = [series('s', 'Series', [entry('one', 'New Spring', 'Robert Jordan'), entry('two', 'New Spring', 'Robert Jordan')])]
    const owned = book('owned', 'The New Spring')
    // Duplicates within a series reconcile as one work. Across distinct series ambiguity remains.
    const ambiguous = [catalog[0], series('different', 'Different Series', [entry('other', 'New Spring', 'Robert Jordan')])]
    expect(reconcileCatalog(ambiguous, [owned]).every(item => item.entries.every(e => !e.work.editions.length))).toBe(true)
    const target = [series('one', 'Wheel', [entry('spring', 'New Spring', 'Robert Jordan')])]
    expect(reconcileCatalog([series('unknown', 'Unknown series', [entry('unknown', 'Book', 'Unknown')])], [book('unknown', 'Book', 'Unknown')])[0].entries[0].work.editions).toEqual([])
    for (const candidate of [book('foreign', 'New Spring', 'Another Author'), book('part', 'New Spring Part 1'), { ...owned, workId: 'different-work' }, { ...owned, contents: [{ workId: 'different-work' }] }]) expect(reconcileCatalog(target, [candidate])[0].entries[0].work.editions).toEqual([])
  })
  it('keeps conflicting confirmed positions available instead of merging away a correction', () => {
    const first = { ...entry('one', 'No Life Forsaken'), position: '2', isConfirmed: true }
    const second = { ...entry('two', 'No Life Forsaken'), position: '3', isConfirmed: true }
    expect(reconcileCatalog([series('one', 'Tales of Witness', [first]), series('two', 'Witness', [second])], [])[0].entries).toHaveLength(2)
  })
  it('fills only absent Dark Tower positions and preserves manual corrections', () => {
    const input = [entry('seven', 'The Dark Tower', 'Stephen King'), entry('one', 'The Gunslinger', 'Stephen King'), entry('half', 'The Wind Through the Keyhole', 'Stephen King'), { ...entry('edited', 'Wizard and Glass', 'Stephen King'), position: '44', isConfirmed: true }, { ...entry('blank', 'Song of Susannah', 'Stephen King'), isConfirmed: true }]
    const result = reconcileCatalog([series('tower', 'The Dark Tower', input)], [])[0].entries
    expect(result.map(item => item.position)).toEqual([7, 1, 4.5, '44', null])
    expect(result[2].positionSource).toBe('https://stephenking.com/darktower/book/')
    expect(input[0].position).toBeNull()
  })
  it('shows omnibus contents once, retaining confirmed standalone entries', () => {
    const omnibus = book('omnibus', 'Bauchelain and Korbal Broach 1', 'Steven Erikson')
    const bundle = entry('bundle', omnibus.title); bundle.work.editions = [omnibus]
    const contents = [entry('first', 'Blood Follows'), entry('second', 'The Healthy Dead')]
    for (const item of contents) item.work.containedIn = [{ book: omnibus }]
    const source = [series('one', 'Bauchelain & Korbal Broach', contents), series('two', 'Bauchelain and Korbal Broach', [bundle])]
    expect(reconcileCatalog(source, [omnibus])[0].entries.map(item => item.id)).toEqual(['first', 'second'])
    bundle.isConfirmed = true
    expect(reconcileCatalog(source, [omnibus])[0].entries).toHaveLength(3)
  })
})
