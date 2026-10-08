import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import SeriesPage from '@/app/series/page'
import type { ChecklistSeries } from '@/lib/series/checklist'

const data: ChecklistSeries = { id: 'series-one', name: 'A Series', description: null, entries: [
  { id: 'first', position: '0.5', entryType: 'NOVELLA', isConfirmed: false, work: { id: 'first-work', title: 'First novella', authorName: 'An Author', publicationYear: 1990, editions: [], containedIn: [{ book: { id: 'edition', title: 'An Omnibus', readingStatus: 'READ', isbn13: null } }] } },
  { id: 'second', position: '1', entryType: 'MAIN', isConfirmed: false, work: { id: 'second-work', title: 'Second novel', authorName: 'An Author', publicationYear: null, editions: [], containedIn: [] } },
] }
let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetcher = vi.fn(async (url: string, options?: { method?: string }) => ({ ok: true, status: 200, json: async () => url === '/api/series' ? { series: [data] } : url === '/api/library/sync' ? { authors: [{ name: 'An Author', books: [{ id: 'edition', title: 'An Omnibus' }] }] } : url === '/api/collection-import' ? { import: null } : { book: {} } }))
  vi.stubGlobal('fetch', fetcher)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('series checklist interface', () => {
  it('shows owned omnibus contents, missing works, and unknown years', async () => {
    render(<SeriesPage />)
    expect(await screen.findByText('First novella')).toBeDefined()
    expect(screen.getByText('Second novel')).toBeDefined()
    expect(screen.getByText(/Year unknown/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'An Omnibus' }).getAttribute('href')).toBe('/library/book/edition')
  })
  it('filters missing works without changing ownership', async () => {
    render(<SeriesPage />); await screen.findByText('First novella')
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'missing' } })
    expect(screen.queryByText('First novella')).toBeNull()
    expect(screen.getByText('Second novel')).toBeDefined()
    expect(fetcher.mock.calls.every(call => !call[1]?.method || call[1].method === 'GET')).toBe(true)
  })
  it('updates the physical edition reading status rather than the literary work', async () => {
    render(<SeriesPage />); await screen.findByText('First novella')
    fireEvent.change(screen.getByLabelText('Reading status for An Omnibus'), { target: { value: 'READING' } })
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/books/edition', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ readingStatus: 'READING' }) })))
  })
  it('offers existing-work membership and manual publication/order corrections', async () => {
    render(<SeriesPage />); await screen.findByText('First novella')
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    expect(screen.getByLabelText('Original publication year')).toBeDefined()
    expect(screen.getByLabelText('Series position')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Look up metadata' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Link edition' })).toBeDefined()
  })
})
