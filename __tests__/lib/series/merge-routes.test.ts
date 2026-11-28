// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), options: vi.fn(), preview: vi.fn(), apply: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }))
vi.mock('@/lib/series/merge-service', async original => ({ ...await original<typeof import('@/lib/series/merge-service')>(), seriesMergeOptions: mocks.options, previewSeriesMerge: mocks.preview, applySeriesMerge: mocks.apply }))
import { GET, POST } from '@/app/api/series/merge/route'
import { MergeError } from '@/lib/series/merge-service'
const targetId = '11111111-1111-4111-8111-111111111111', sourceId = '22222222-2222-4222-8222-222222222222'
const body = { mode: 'preview', targetId, sourceId, name: 'Canonical' }
const req = (value?: unknown) => new NextRequest('http://localhost/api/series/merge', value ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) } : undefined)
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner' }); mocks.options.mockResolvedValue([]); mocks.preview.mockResolvedValue({ version: 'a'.repeat(64) }) })
describe('series merge authorization', () => {
  it('rejects anonymous reads and writes before accessing catalogs', async () => { mocks.session.mockResolvedValue(null); expect((await GET(req())).status).toBe(401); expect((await POST(req(body))).status).toBe(401); expect(mocks.preview).not.toHaveBeenCalled() })
  it('uses the signed-in account and prevents private browser caching', async () => { const response = await POST(req(body)); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(mocks.preview).toHaveBeenCalledWith('owner', body); expect(mocks.apply).not.toHaveBeenCalled() })
  it('rejects unknown fields, missing versions, invalid IDs and invalid resolution modes', async () => { for (const input of [{ ...body, userId: 'foreign' }, { ...body, sourceId: 'bad' }, { ...body, mode: 'apply' }, { ...body, mode: 'apply', version: 'a'.repeat(64), description: null, resolutions: [{ groupId: 'a'.repeat(64), mode: 'delete', entryId: targetId, workId: sourceId }] }]) expect((await POST(req(input))).status).toBe(400); expect(mocks.apply).not.toHaveBeenCalled() })
  it('returns account-scoped not-found and stale-preview errors', async () => { mocks.preview.mockRejectedValueOnce(new MergeError(404, 'Series not found.')); expect((await POST(req(body))).status).toBe(404); mocks.apply.mockRejectedValue(new MergeError(409, 'Create a fresh preview.')); expect((await POST(req({ ...body, mode: 'apply', version: 'a'.repeat(64), description: null, resolutions: [] }))).status).toBe(409) })
})
