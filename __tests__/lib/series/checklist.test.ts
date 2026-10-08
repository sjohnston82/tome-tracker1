import { describe, it, expect } from 'vitest'
import { checklistStats, ownedEditions, type ChecklistEntry } from '@/lib/series/checklist'

const edition = { id: 'one', title: 'An Omnibus', readingStatus: 'READ' as const, isbn13: null }
const entry = (): ChecklistEntry => ({ id: 'entry', position: '0.5', entryType: 'NOVELLA', isConfirmed: false, work: { id: 'work', title: 'First novella', authorName: 'An Author', publicationYear: null, editions: [], containedIn: [{ book: edition }] } })
describe('series checklist ownership', () => {
  it('counts omnibus content as owned without counting one edition twice', () => {
    const first = entry(); first.work.editions.push(edition)
    expect(ownedEditions(first)).toHaveLength(1)
    expect(checklistStats({ id: 'series', name: 'Series', description: null, entries: [first] })).toEqual({ total: 1, owned: 1, missing: 0, read: 1 })
  })
  it('requires every linked split volume to be read', () => {
    const first = entry(); first.work.editions.push({ ...edition, id: 'two', readingStatus: 'UNREAD' })
    expect(checklistStats({ id: 'series', name: 'Series', description: null, entries: [first] }).read).toBe(0)
  })
  it('keeps missing works separate from owned books', () => {
    const first = entry(); first.work.containedIn = []
    expect(checklistStats({ id: 'series', name: 'Series', description: null, entries: [first] })).toEqual({ total: 1, owned: 0, missing: 1, read: 0 })
  })
})
