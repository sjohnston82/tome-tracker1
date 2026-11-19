import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { ReadingTracker } from '@/components/library/reading-tracker'
import { CurrentlyReading } from '@/components/library/currently-reading'
const session = { id: 'session', baselinePage: 224, totalPages: 480, startedAt: null, trackedAt: '2026-11-19T15:00:00Z', finishedAt: null, version: 0, logs: [] }
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('reading progress interface', () => {
  it('highlights only currently reading books and offers a zero-credit starting point', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ session: null }) }))
    render(<CurrentlyReading authors={[{ name: 'An Author', books: [{ id: 'active', title: 'Current novel', readingStatus: 'READING' }, { id: 'old', title: 'Previously read', readingStatus: 'READ' }, { id: 'next', title: 'Next novel', readingStatus: 'UNREAD' }] }]} onChanged={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Current novel' })).toBeDefined()
    expect(screen.queryByText('Previously read')).toBeNull()
    expect(screen.queryByText('Next novel')).toBeNull()
    expect(await screen.findByRole('button', { name: 'Set starting point' })).toBeDefined()
    expect(screen.getByText(/Earlier reading will not be estimated/)).toBeDefined()
  })
  it('does not backfill completion dates or offer to track legacy read books', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ session: null }) })
    vi.stubGlobal('fetch', fetcher)
    render(<ReadingTracker bookId="old" status="READ" onChanged={vi.fn()} />)
    await screen.findByText(/historical completion date remains unknown/)
    expect(screen.queryByRole('button', { name: 'Start reading' })).toBeNull()
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
  it('starts an unread book only on explicit request', async () => {
    const changed = vi.fn().mockResolvedValue(undefined)
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => ({ ok: true, json: async () => ({ session: options?.method === 'POST' ? { ...session, baselinePage: 0 } : null }) }))
    vi.stubGlobal('fetch', fetcher)
    render(<ReadingTracker bookId="unread" status="UNREAD" onChanged={changed} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Start reading' }))
    await waitFor(() => expect(changed).toHaveBeenCalledOnce())
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toEqual({ action: 'start', page: 0, totalPages: null })
  })
  it('logs a stopping page, timestamp and note without crediting the baseline', async () => {
    const changed = vi.fn().mockResolvedValue(undefined)
    const fetcher = vi.fn(async (_url: string, options?: RequestInit) => {
      const body = options?.body ? JSON.parse(options.body as string) : null
      return { ok: true, json: async () => ({ session: body ? { ...session, version: 1, logs: [{ id: 'entry', page: body.page, occurredAt: body.occurredAt, createdAt: body.occurredAt, note: body.note, isCompletion: false }] } : session }) }
    })
    vi.stubGlobal('fetch', fetcher)
    render(<ReadingTracker bookId="active" status="READING" onChanged={changed} />)
    await screen.findByText('0 pages logged since your starting point')
    fireEvent.click(screen.getByRole('button', { name: 'Log progress' }))
    fireEvent.change(screen.getByLabelText('Stopped on page'), { target: { value: '230' } })
    fireEvent.change(screen.getByLabelText('Reading note (optional)'), { target: { value: 'Chapter five' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save progress' }))
    await screen.findByText('6 pages logged since your starting point')
    expect(JSON.parse(fetcher.mock.calls[1][1]!.body as string)).toMatchObject({ action: 'log', page: 230, note: 'Chapter five', finish: false, requestId: expect.any(String), occurredAt: expect.stringMatching(/Z$/) })
  })
})
