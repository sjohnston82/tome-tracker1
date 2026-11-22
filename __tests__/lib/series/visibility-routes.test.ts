// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), set: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }))
vi.mock('@/lib/series/visibility-service', async original => ({ ...await original<typeof import('@/lib/series/visibility-service')>(), setSeriesVisibility: mocks.set }))
import { PATCH } from '@/app/api/series/[id]/visibility/route'
import { VisibilityError } from '@/lib/series/visibility-service'
const id = '11111111-1111-4111-8111-111111111111', body = { mode: 'following', version: 'a'.repeat(64) }
const req = (value = body) => new NextRequest(`http://localhost/api/series/${id}/visibility`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) })
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner' }); mocks.set.mockResolvedValue({ mode: 'following' }) })
describe('shelf preference API', () => {
  it('requires a signed-in session and only changes that account', async () => { mocks.session.mockResolvedValueOnce(null); expect((await PATCH(req())).status).toBe(401); expect(mocks.set).not.toHaveBeenCalled(); const response = await PATCH(req()); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(mocks.set).toHaveBeenCalledWith('owner', id, body) })
  it('rejects unsupported fields and values before writing', async () => {
    expect((await PATCH(req({ ...body, mode: 'deleted' }))).status).toBe(400)
    const invalid = new NextRequest(`http://localhost/api/series/${id}/visibility`, { method: 'PATCH', body: JSON.stringify({ ...body, userId: 'other' }) })
    expect((await PATCH(invalid)).status).toBe(400)
    expect(mocks.set).not.toHaveBeenCalled()
  })
  it('reports foreign series and stale choices explicitly', async () => { mocks.set.mockRejectedValueOnce(new VisibilityError(404, 'Series not found.')); expect((await PATCH(req())).status).toBe(404); mocks.set.mockRejectedValueOnce(new VisibilityError(409, 'Refresh Series.')); expect((await PATCH(req())).status).toBe(409) })
})
