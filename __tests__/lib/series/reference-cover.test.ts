// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), cover: vi.fn(), rate: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }))
vi.mock('@/lib/db', () => ({ prisma: { work: { findFirst: mocks.find } } }))
vi.mock('@/lib/metadata/covers', () => ({ findBookCover: mocks.cover }))
vi.mock('@/lib/api/response', async original => ({ ...await original<typeof import('@/lib/api/response')>(), checkRateLimit: mocks.rate }))
import { GET } from '@/app/api/works/[id]/cover/route'
import { referenceCover } from '@/lib/series/reference-cover'
const request = () => new NextRequest('http://localhost/api/works/work/cover')
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner', role: 'USER' }); mocks.find.mockResolvedValue({ title: 'A book', authorName: 'An Author', updatedAt: new Date('2026-01-01') }); mocks.rate.mockReturnValue({ allowed: true }); mocks.cover.mockResolvedValue('https://covers.openlibrary.org/b/id/42-L.jpg') })
afterEach(() => vi.useRealTimers())
describe('private reference artwork', () => {
  it('rejects anonymous and cross-account requests before provider lookup', async () => {
    mocks.session.mockResolvedValueOnce(null)
    expect((await GET(request())).status).toBe(401)
    expect(mocks.find).not.toHaveBeenCalled()
    mocks.find.mockResolvedValue(null)
    expect((await GET(request())).status).toBe(404)
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'work', userId: 'owner' } }))
    expect(mocks.cover).not.toHaveBeenCalled()
  })
  it('returns private read-only artwork, rechecks ownership on cache hits and honors rate limits', async () => {
    const response = await GET(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.json()).toEqual({ coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' })
    expect((await GET(request())).status).toBe(200)
    expect(mocks.find).toHaveBeenCalledTimes(2)
    expect(mocks.cover).toHaveBeenCalledTimes(1)
    mocks.rate.mockReturnValue({ allowed: false })
    expect((await GET(request())).status).toBe(429)
  })
  it('deduplicates overlapping lookups and separates account and metadata revisions', async () => {
    const key = 'dedup-owner-work-version'
    await Promise.all([referenceCover(key, 'Book', 'Author'), referenceCover(key, 'Book', 'Author')])
    expect(mocks.cover).toHaveBeenCalledTimes(1)
    await referenceCover('other-owner-work-version', 'Book', 'Author')
    await referenceCover('dedup-owner-work-new-version', 'Corrected book', 'Author')
    expect(mocks.cover).toHaveBeenCalledTimes(3)
  })
  it('expires negative results and never caches provider failures', async () => {
    vi.useFakeTimers(); mocks.cover.mockResolvedValueOnce(null)
    expect(await referenceCover('negative', 'Book', 'Author')).toBeNull()
    expect(await referenceCover('negative', 'Book', 'Author')).toBeNull()
    expect(mocks.cover).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(900001)
    expect(await referenceCover('negative', 'Book', 'Author')).toContain('42')
    mocks.cover.mockRejectedValueOnce(new Error('Provider unavailable'))
    await expect(referenceCover('failure', 'Book', 'Author')).rejects.toThrow()
    await expect(referenceCover('failure', 'Book', 'Author')).resolves.toContain('42')
  })
  it('returns a retryable error without leaking provider details', async () => {
    mocks.find.mockResolvedValue({ title: 'New book', authorName: 'Author', updatedAt: new Date('2026-02-01') })
    mocks.cover.mockRejectedValue(new Error('provider-secret'))
    const response = await GET(request())
    expect(response.status).toBe(503)
    expect(await response.text()).not.toContain('provider-secret')
  })
})
