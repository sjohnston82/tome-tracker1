import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { CoverEnrichment } from '@/components/library/cover-enrichment'
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('automatic cover search', () => {
  it('starts automatically and continues past a batch with zero matches', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ processed: 5, updated: 0, errors: 0, next: 'next-book' }) }).mockResolvedValueOnce({ ok: true, json: async () => ({ processed: 2, updated: 1, errors: 0, next: null }) })
    vi.stubGlobal('fetch', fetcher)
    const updated = vi.fn().mockResolvedValue(undefined)
    render(<CoverEnrichment authors={[{ books: [{ id: 'one', coverUrl: null }] }]} onUpdated={updated} />)
    await screen.findByText(/Cover search complete: 7 books checked, 1 covers found/)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({ after: 'next-book' })
    expect(updated).toHaveBeenCalledOnce()
  })
  it('distinguishes provider failures from successful searches without a cover', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ processed: 1, updated: 0, errors: 1, next: null }) }))
    render(<CoverEnrichment authors={[{ books: [{ id: 'one' }] }]} onUpdated={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('1 requests failed'))
  })
})
