// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), owned: vi.fn(), lookup: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/books/service', () => ({ checkOwnership: mocks.owned }));
vi.mock('@/lib/metadata', () => ({ lookupByIsbn: mocks.lookup }));
import { GET } from '@/app/api/lookup/isbn/[code]/route';
const request = (code: string) => new NextRequest(`http://localhost/api/lookup/isbn/${encodeURIComponent(code)}`);
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'scan-owner' }); mocks.owned.mockResolvedValue(false); mocks.lookup.mockResolvedValue(null); });
describe('scan lookup validation and ownership', () => {
  it('rejects anonymous requests before any library or catalog lookup', async () => {
    mocks.session.mockResolvedValue(null); expect((await GET(request('9780553579901'))).status).toBe(401);
    expect(mocks.owned).not.toHaveBeenCalled(); expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('does not slice ISBNs from a UPC or query catalogs for non-book EANs', async () => {
    for (const code of ['030640615200', '4006381333931', '9780553579902']) expect(await (await GET(request(code))).json()).toMatchObject({ isIsbn: false, metadata: null });
    expect(mocks.owned).not.toHaveBeenCalled(); expect(mocks.lookup).not.toHaveBeenCalled();
  });
  it('normalizes ISBN-10 and scopes ownership to the signed-in user even when metadata is unavailable', async () => {
    mocks.owned.mockResolvedValue(true);
    const response = await GET(request('0-553-57990-8')); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ isIsbn: true, normalizedIsbn: '9780553579901', owned: true, metadata: null });
    expect(mocks.owned).toHaveBeenCalledWith('scan-owner', '9780553579901'); expect(mocks.lookup).toHaveBeenCalledWith('9780553579901');
  });
});
