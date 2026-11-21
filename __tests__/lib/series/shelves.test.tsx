import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { groupSeriesByAuthor, orderedSeriesEntries, seriesAuthor, seriesEntryArtwork } from '@/lib/series/shelves'
import { SeriesShelves } from '@/components/series/series-shelves'
import type { ChecklistEntry, ChecklistSeries } from '@/lib/series/checklist'
const entry = (title: string, author = 'Jim Butcher', position: string | null = '1'): ChecklistEntry => ({ id: title, position, entryType: 'MAIN', isConfirmed: false, work: { id: title, title, authorName: author, publicationYear: null, editions: [], containedIn: [] } })
const series = (name: string, entries: ChecklistEntry[]): ChecklistSeries => ({ id: name, name, description: null, entries })
const book = { id: 'omnibus', title: 'Collected stories', isbn13: null, readingStatus: 'UNREAD' as const, coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg', coverLocked: true }
afterEach(cleanup)
describe('series shelves', () => {
  it('groups by surnames, files collaborations under the earliest surname and keeps empty series', () => {
    const groups = groupSeriesByAuthor([series('Dresden', [entry('Storm Front')]), series('Collaboration', [entry('Shared', 'Larry Niven & Arthur Clarke')]), series('Malazan', [entry('Gardens', 'Steven Erikson')]), series('Empty', [])])
    expect(groups.map(group => group.letter)).toEqual(['#', 'B', 'C', 'E'])
    expect(groups[2].authors[0].series[0].name).toBe('Collaboration')
    expect(seriesAuthor(series('Mixed', [entry('Main'), { ...entry('Companion', 'Another Author'), entryType: 'COMPANION' }]))).toBe('Jim Butcher')
  })
  it('keeps prequels, novellas and unknown positions in numeric order without mutating entries', () => {
    const entries = ['10', null, '2', '0.5', '0', '1'].map((position, i) => entry(String(i), undefined, position))
    expect(orderedSeriesEntries(entries).map(item => item.position)).toEqual(['0', '0.5', '1', '2', '10', null])
    expect(entries[0].position).toBe('10')
  })
  it('uses locked omnibus artwork and preserves explicitly removed covers', () => {
    const owned = entry('Novella'); owned.work.containedIn = [{ book }]
    expect(seriesEntryArtwork(owned)).toMatchObject({ coverUrl: book.coverUrl, allowReference: false, editions: [book] })
    owned.work.containedIn[0].book = { ...book, coverUrl: null }
    expect(seriesEntryArtwork(owned)).toMatchObject({ coverUrl: null, allowReference: false })
    expect(seriesEntryArtwork(entry('Missing')).allowReference).toBe(true)
  })
  it('shows all entries with ownership labels, keeps missing artwork gray on hover, and has no default selection', () => {
    const owned = entry('Owned novella', undefined, '0.5'); owned.work.containedIn = [{ book }]
    render(<SeriesShelves series={[series('Dresden', [entry('Missing novel'), owned])]} selected={null} onSelect={() => {}} details={() => null} />)
    const row = screen.getByRole('list', { name: 'Books in Dresden' })
    expect([...row.querySelectorAll('li')].map(item => item.getAttribute('data-entry-id'))).toEqual(['Owned novella', 'Missing novel'])
    expect(within(row).getByRole('link', { name: 'Owned novella — Owned' }).getAttribute('href')).toBe('/library/book/omnibus')
    const missing = within(row).getByRole('button', { name: /Missing novel/ })
    expect(missing.querySelector('[data-ownership=missing]')?.classList.contains('grayscale')).toBe(true)
    expect(row.querySelector('[data-ownership=owned]')?.classList.contains('grayscale')).toBe(false)
    expect(screen.getByRole('status', { name: 'Focused book in Dresden' }).textContent).toContain('2 recorded entries')
    fireEvent.mouseEnter(missing)
    expect(missing.querySelector('[data-ownership=missing]')?.classList.contains('grayscale')).toBe(true)
    expect(screen.getByRole('status', { name: 'Focused book in Dresden' }).textContent).toContain('Missing novel')
    expect(screen.getByRole('button', { name: /Manage checklist/ }).getAttribute('aria-expanded')).toBe('false')
  })
})
