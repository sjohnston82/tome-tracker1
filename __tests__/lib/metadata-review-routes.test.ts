// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), resolve: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/review/service', () => ({ getMetadataReview: mocks.get, resolveMetadataReview: mocks.resolve }));
import { GET, PATCH } from '@/app/api/metadata-review/route';
const input = { id: 'a'.repeat(64), version: 'b'.repeat(64), action: 'keep' };
const req = (body: unknown) => new NextRequest('http://localhost/api/metadata-review', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner' }); mocks.get.mockResolvedValue({ items: [] }); mocks.resolve.mockResolvedValue({ success: true }); });
describe('metadata review API isolation and validation', () => {
  it('rejects anonymous reads and decisions before touching data', async () => {
    mocks.session.mockResolvedValue(null); expect((await GET(new NextRequest('http://localhost/api/metadata-review'))).status).toBe(401); expect((await PATCH(req(input))).status).toBe(401); expect(mocks.get).not.toHaveBeenCalled(); expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it('uses the session owner and private no-store responses', async () => {
    const response = await GET(new NextRequest('http://localhost/api/metadata-review')); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.get).toHaveBeenCalledWith('owner'); expect((await PATCH(req(input))).status).toBe(200); expect(mocks.resolve).toHaveBeenCalledWith('owner', input);
  });
  it('rejects arbitrary fields, inappropriate values and invalid years before mutation', async () => {
    for (const body of [{ ...input, userId: 'other' }, { ...input, title: 'Replace title' }, { ...input, value: 2026 }, { ...input, action: 'year', value: 0 }, { ...input, action: 'pin' }]) expect((await PATCH(req(body))).status).toBe(400);
    expect(mocks.resolve).not.toHaveBeenCalled();
  });
  it('reports stale/conflicting decisions and unknown private items without leaking records', async () => {
    mocks.resolve.mockResolvedValueOnce({ error: 'STALE_REVIEW' }); expect((await PATCH(req(input))).status).toBe(409);
    mocks.resolve.mockResolvedValueOnce({ error: 'NOT_FOUND' }); expect((await PATCH(req(input))).status).toBe(404);
  });
});
