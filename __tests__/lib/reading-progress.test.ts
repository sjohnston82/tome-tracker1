import { describe, expect, it } from 'vitest'
import { readingProgress } from '@/lib/reading/progress'
import { readingInput } from '@/lib/reading/validation'
const entry = (page: number, day: number) => ({ id: String(day), page, occurredAt: `2026-11-${day}T15:48:00Z`, createdAt: `2026-11-${day}T15:48:00Z`, note: '', isCompletion: false })
describe('forward-only reading history', () => {
  it('excludes the initial baseline and does not double count revisited pages', () => {
    const session = { baselinePage: 224, totalPages: 480, logs: [entry(230, 19), entry(226, 20), entry(240, 21)] }
    expect(readingProgress(session)).toMatchObject({ currentPage: 240, pagesLogged: 16, percent: 50 })
    expect(readingProgress({ ...session, logs: [] })).toMatchObject({ currentPage: 224, pagesLogged: 0 })
  })
  it('uses chronological order for backdated entries and corrections', () => {
    expect(readingProgress({ baselinePage: 0, totalPages: null, logs: [entry(50, 21), entry(20, 19), entry(30, 20)] })).toMatchObject({ currentPage: 50, pagesLogged: 50, percent: null })
    expect(readingProgress({ baselinePage: 0, totalPages: null, logs: [entry(20, 19), entry(15, 20)] }).pagesLogged).toBe(20)
  })
  it('validates page limits, times and idempotency keys', () => {
    expect(readingInput.safeParse({ action: 'start', page: -1 }).success).toBe(false)
    expect(readingInput.safeParse({ action: 'start', page: 1.5 }).success).toBe(false)
    expect(readingInput.safeParse({ action: 'start', page: 0, totalPages: 0 }).success).toBe(false)
    expect(readingInput.safeParse({ action: 'log', page: 2, occurredAt: 'yesterday' }).success).toBe(false)
    expect(readingInput.parse({ action: 'start' })).toMatchObject({ page: 0, totalPages: null })
  })
})
