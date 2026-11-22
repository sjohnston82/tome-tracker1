import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor, act } from '@testing-library/react'
import { CacheOwnerProvider } from '@/lib/offline/owner'
import { OwnershipReview } from '@/components/series/ownership-review'
import type { OwnershipReview as Review } from '@/lib/series/ownership-types'
const review: Review = { work: { id: 'work', title: 'New Spring', author: 'Robert Jordan' }, version: 'a'.repeat(64), copies: [{ id: 'book', title: 'The New Spring', author: 'Robert Jordan', isbn13: '9780000000000', readingStatus: 'READING', state: 'matched', links: [], otherWorks: [], reason: 'Unlinked library copy matches this title and author. Confirmation is still needed.' }] }
let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => { fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ review }) }); vi.stubGlobal('fetch', fetcher) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
const props = { workId: 'work', title: 'New Spring', open: true, onToggle: vi.fn(), disabled: false, onSaved: vi.fn().mockResolvedValue(undefined) }
describe('ownership review controls', () => {
  it('loads evidence on demand and requires a concrete confirmation before posting', async () => {
    const view = render(<OwnershipReview {...props} open={false} />)
    expect(fetcher).not.toHaveBeenCalled()
    view.rerender(<OwnershipReview {...props} />)
    await screen.findByText('Suggested match — needs confirmation')
    expect(screen.getByRole('link', { name: 'The New Spring' }).getAttribute('href')).toBe('/library/book/book')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this copy' }))
    expect(screen.getByRole('group', { name: 'Confirm ownership change' }).textContent).toContain('The New Spring')
    expect(fetcher).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(fetcher).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'Confirm this copy' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm ownership change' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/works/work/ownership', expect.objectContaining({ method: 'POST', body: JSON.stringify({ action: 'link', bookId: 'book', version: review.version }) })))
  })
  it('rejects suggestions only after confirmation and displays preserved-book consequences', async () => {
    render(<OwnershipReview {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Not this copy' }))
    expect(screen.getByRole('group', { name: 'Confirm ownership change' }).textContent).toContain('The physical book stays in your library')
    fireEvent.click(screen.getByRole('button', { name: 'Confirm ownership change' }))
    await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/works/work/ownership', expect.objectContaining({ body: JSON.stringify({ action: 'reject', bookId: 'book', version: review.version }) })))
  })
  it('forces a fresh review after a stale write and never retries a mutation automatically', async () => {
    render(<OwnershipReview {...props} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm this copy' }))
    fetcher.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'Your library changed. Refresh this review before saving.' }) })
    fireEvent.click(screen.getByRole('button', { name: 'Confirm ownership change' }))
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Confirm ownership change' })).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(2)
    fireEvent.click(screen.getByRole('button', { name: 'Refresh ownership review' }))
    await screen.findByRole('button', { name: 'Confirm this copy' })
    expect(fetcher).toHaveBeenCalledTimes(3)
  })
  it('blocks changes offline and makes unrelated contents visible before linking a chosen copy', async () => {
    const candidate = { ...review.copies[0], state: 'candidate' as const, otherWorks: ['A different novella'], reason: 'Select only if this copy contains the work.' }
    fetcher.mockResolvedValue({ ok: true, json: async () => ({ review: { ...review, copies: [candidate] } }) })
    const view = render(<OwnershipReview {...props} disabled />)
    await screen.findByLabelText('Physical copy')
    fireEvent.change(screen.getByLabelText('Physical copy'), { target: { value: 'book' } })
    expect((screen.getByRole('button', { name: 'Review selected copy' }) as HTMLButtonElement).disabled).toBe(true)
    view.rerender(<OwnershipReview {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Review selected copy' }))
    expect(screen.getByRole('group', { name: 'Confirm ownership change' }).textContent).toContain('A different novella')
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})

it('ignores a previous account’s pending save response after the owner changes', async () => {
  let finishSave: (value: unknown) => void = () => {}
  const saved = vi.fn().mockResolvedValue(undefined)
  fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ review }) })
  const view = render(<CacheOwnerProvider userId="owner-a"><OwnershipReview {...props} onSaved={saved} /></CacheOwnerProvider>)
  fireEvent.click(await screen.findByRole('button', { name: 'Confirm this copy' }))
  fetcher.mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve }))
  const confirmButton = screen.getByRole('button', { name: 'Confirm ownership change' })
  fireEvent.click(confirmButton)
  fireEvent.click(confirmButton)
  expect(fetcher).toHaveBeenCalledTimes(2)
  fetcher.mockResolvedValueOnce({ ok: true, json: async () => ({ review: { ...review, copies: [] } }) })
  view.rerender(<CacheOwnerProvider userId="owner-b"><OwnershipReview {...props} onSaved={saved} /></CacheOwnerProvider>)
  expect(screen.queryByRole('link', { name: 'The New Spring' })).toBeNull()
  await screen.findByText('No owned copy is linked or automatically matched to this work.')
  await act(async () => finishSave({ ok: true, json: async () => ({ review }) }))
  expect(screen.queryByRole('link', { name: 'The New Spring' })).toBeNull()
  expect(saved).not.toHaveBeenCalled()
})
