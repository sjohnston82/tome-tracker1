import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react'
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
  it('starts with no series selected', async () => {
    render(<SeriesPage />)
    const button = await screen.findByRole('button', { name: /A Series/ })
    expect(button.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: 'A Series checklist' })).toBeNull()
  })
  it('expands details immediately after the clicked series and collapses on a second click', async () => {
    const other = { ...data, id: 'series-two', name: 'Another Series', entries: [] }
    fetcher.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url === '/api/series' ? { series: [data, other] } : url === '/api/library/sync' ? { authors: [] } : { import: null } }))
    render(<SeriesPage />)
    await screen.findByRole('button', { name: /A Series/ })
    fireEvent.click(screen.getByLabelText('Show series with no owned books'))
    const button = await screen.findByRole('button', { name: /Another Series/ })
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('article', { name: 'Another Series shelf' }).contains(screen.getByRole('region', { name: 'Another Series checklist' }))).toBe(true)
    expect(screen.queryByRole('region', { name: 'A Series checklist' })).toBeNull()
    fireEvent.click(button)
    expect(screen.queryByRole('region', { name: 'Another Series checklist' })).toBeNull()
  })
  it('shows owned omnibus contents, missing works, and unknown years', async () => {
    render(<SeriesPage />)
    fireEvent.click(await screen.findByRole('button', { name: /A Series/ }))
    expect(within(screen.getByRole('region', { name: 'A Series checklist' })).getByText('First novella')).toBeDefined()
    expect(within(screen.getByRole('region', { name: 'A Series checklist' })).getByText('Second novel')).toBeDefined()
    expect(screen.getByText(/Year unknown/)).toBeDefined()
    expect(screen.getByRole('link', { name: 'An Omnibus' }).getAttribute('href')).toBe('/library/book/edition')
  })
  it('filters missing works without changing ownership', async () => {
    render(<SeriesPage />); fireEvent.click(await screen.findByRole('button', { name: /A Series/ })); await screen.findByRole('region', { name: 'A Series checklist' })
    fireEvent.change(screen.getByLabelText('Show'), { target: { value: 'missing' } })
    expect(within(screen.getByRole('region', { name: 'A Series checklist' })).queryByText('First novella')).toBeNull()
    expect(screen.getByRole('list', { name: 'Books in A Series' }).querySelectorAll('li')).toHaveLength(2)
    expect(within(screen.getByRole('region', { name: 'A Series checklist' })).getByText('Second novel')).toBeDefined()
    expect(fetcher.mock.calls.every(call => !call[1]?.method || call[1].method === 'GET')).toBe(true)
  })
  it('updates the physical edition reading status rather than the literary work', async () => {
    render(<SeriesPage />); fireEvent.click(await screen.findByRole('button', { name: /A Series/ })); await screen.findByRole('region', { name: 'A Series checklist' })
    fireEvent.change(screen.getByLabelText('Reading status for An Omnibus'), { target: { value: 'READING' } })
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/books/edition', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ readingStatus: 'READING' }) })))
  })
  it('offers existing-work membership and manual publication/order corrections', async () => {
    render(<SeriesPage />); fireEvent.click(await screen.findByRole('button', { name: /A Series/ })); await screen.findByRole('region', { name: 'A Series checklist' })
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0])
    expect(screen.getByLabelText('Original publication year')).toBeDefined()
    expect(screen.getByLabelText('Series position')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Look up metadata' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Review ownership for First novella' })).toBeDefined()
  })
})

it('searches by author or a title while retaining the whole matching shelf', async () => {
  render(<SeriesPage />)
  await screen.findByRole('button', { name: /A Series/ })
  for (const search of ['An Author', 'Second novel']) {
    fireEvent.change(screen.getByLabelText('Search series, authors or titles'), { target: { value: search } })
    expect(screen.getByRole('list', { name: 'Books in A Series' }).querySelectorAll('li')).toHaveLength(2)
  }
})

it('hides catalog-only series until requested', async () => {
  const missingOnly = { ...data, id: 'missing-only', name: 'Malazan short fiction', entries: [data.entries[1]] }
  fetcher.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url === '/api/series' ? { series: [data, missingOnly] } : url === '/api/library/sync' ? { authors: [] } : { import: null } }))
  render(<SeriesPage />)
  await screen.findByRole('button', { name: /A Series/ })
  expect(screen.queryByRole('article', { name: 'Malazan short fiction shelf' })).toBeNull()
  fireEvent.click(screen.getByLabelText('Show series with no owned books'))
  expect(screen.getByRole('article', { name: 'Malazan short fiction shelf' })).toBeDefined()
})

it('shows followed missing series and exposes hidden shelves only when explicitly requested', async () => {
  const followed = { ...data, id: 'followed', name: 'Following Series', visibility: 'following', entries: [data.entries[1]] }
  const hidden = { ...data, id: 'hidden', name: 'Hidden Owned Series', visibility: 'hidden' }
  fetcher.mockImplementation(async (url: string) => ({ ok: true, status: 200, json: async () => url === '/api/series' ? { series: [followed, hidden] } : { import: null } }))
  render(<SeriesPage />)
  await screen.findByRole('article', { name: 'Following Series shelf' })
  expect(screen.queryByRole('article', { name: 'Hidden Owned Series shelf' })).toBeNull()
  fireEvent.click(screen.getByLabelText('Show series with no owned books'))
  expect(screen.queryByRole('article', { name: 'Hidden Owned Series shelf' })).toBeNull()
  fireEvent.click(screen.getByLabelText('Show hidden series'))
  expect(screen.getByRole('article', { name: 'Hidden Owned Series shelf' })).toBeDefined()
})
it('saves a shelf choice with its version and refreshes the visible shelves', async () => {
  const original = { ...data, visibility: 'automatic', visibilityVersion: 'a'.repeat(64) }
  fetcher.mockImplementation(async (url: string, options?: { method?: string }) => ({ ok: true, status: 200, json: async () => url === '/api/series' ? { series: [original] } : { import: null } }))
  render(<SeriesPage />)
  const control = await screen.findByLabelText('Shelf preference for A Series')
  fireEvent.change(control, { target: { value: 'following' } })
  await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/series/series-one/visibility', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ mode: 'following', version: original.visibilityVersion }) })))
})
