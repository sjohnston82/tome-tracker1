// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), change: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }))
vi.mock('@/lib/series/ownership-service', async original => ({ ...await original<typeof import('@/lib/series/ownership-service')>(), getOwnershipReview: mocks.get, changeOwnership: mocks.change }))
import { GET, POST } from '@/app/api/works/[id]/ownership/route'
import { OwnershipError } from '@/lib/series/ownership-service'
const work = '11111111-1111-4111-8111-111111111111', bookId = '22222222-2222-4222-8222-222222222222'
const request = (method = 'GET', body?: unknown) => new NextRequest(`http://localhost/api/works/${work}/ownership`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner', role: 'USER' }) })
describe('ownership review HTTP boundary', () => {
  it('requires authentication before reads and writes', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await GET(request())).status).toBe(401)
    expect((await POST(request('POST', {}))).status).toBe(401)
    expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.change).not.toHaveBeenCalled()
  })
  it('uses the signed-in owner and never browser caches a private review', async () => {
    mocks.get.mockResolvedValue({ work: { id: work }, copies: [] })
    const response = await GET(request())
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(mocks.get).toHaveBeenCalledWith('owner', work)
  })
  it('rejects unknown fields, invalid actions, bad IDs and missing review versions before mutation', async () => {
    const base = { action: 'link', bookId, version: 'a'.repeat(64) }
    for (const body of [{ ...base, userId: 'other' }, { ...base, action: 'deleteBook' }, { ...base, bookId: 'bad' }, { action: 'link', bookId }]) expect((await POST(request('POST', body))).status).toBe(400)
    expect(mocks.change).not.toHaveBeenCalled()
  })
  it('returns not-found and stale-review conflicts explicitly', async () => {
    mocks.get.mockRejectedValue(new OwnershipError(404, 'Work not found.'))
    expect((await GET(request())).status).toBe(404)
    mocks.change.mockRejectedValue(new OwnershipError(409, 'Your library changed. Refresh this review before saving.'))
    const response = await POST(request('POST', { action: 'unlink', bookId, version: 'b'.repeat(64) }))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error_code: 'OWNERSHIP_CONFLICT' })
  })
})
