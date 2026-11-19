import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { CoverPicker } from '@/components/library/cover-picker'
const url = 'https://covers.openlibrary.org/b/id/42-L.jpg?default=false'
const option = { url, title: 'An Edition', authors: ['An Author'], source: 'Open Library', publisher: 'Publisher', year: '2000', exactIsbn: true }
const book = { id: 'book', title: 'A Novel', author: { name: 'An Author' }, coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg' }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const setup = () => {
  const fetcher = vi.fn(async (_url: string, init?: RequestInit) => ({ ok: true, json: async () => init?.method === 'PATCH' ? { saved: true } : { options: [option], warnings: [] } }))
  vi.stubGlobal('fetch', fetcher)
  const saved = vi.fn().mockResolvedValue(undefined)
  render(<CoverPicker book={book} onSaved={saved} />)
  fireEvent.click(screen.getByRole('button', { name: 'Choose cover' }))
  return { fetcher, saved }
}
describe('in-app cover picker', () => {
  it('previews a larger image and saves only the explicit cover choice', async () => {
    const { fetcher, saved } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Preview cover 1: An Edition' }))
    expect(screen.getByAltText('Selected cover: An Edition')).toBeDefined()
    expect(screen.getByText('Matches your ISBN')).toBeDefined()
    expect(fetcher).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Use this cover' }))
    await waitFor(() => expect(saved).toHaveBeenCalledOnce())
    expect(fetcher).toHaveBeenLastCalledWith('/api/books/book/covers', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ coverUrl: url }) }))
  })
  it('lets the user refine the search or cancel without changing the book', async () => {
    const { fetcher, saved } = setup()
    await screen.findByText('Matches your ISBN')
    fireEvent.change(screen.getByLabelText('Cover search title'), { target: { value: 'A Different Title' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search covers' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2))
    expect(fetcher.mock.calls[1][0]).toContain('title=A+Different+Title')
    fireEvent.click(screen.getByRole('button', { name: 'Keep current cover' }))
    expect(saved).not.toHaveBeenCalled()
    expect(fetcher.mock.calls.every(([, init]) => !init?.method)).toBe(true)
  })
  it('removes the cover only on explicit request', async () => {
    const { fetcher, saved } = setup()
    await screen.findByText('Matches your ISBN')
    fireEvent.click(screen.getByRole('button', { name: 'Remove cover' }))
    await waitFor(() => expect(saved).toHaveBeenCalledOnce())
    expect(fetcher).toHaveBeenLastCalledWith('/api/books/book/covers', expect.objectContaining({ body: JSON.stringify({ coverUrl: null }) }))
  })
})
