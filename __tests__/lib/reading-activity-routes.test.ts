// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), activity: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/reading/activity-service', () => ({ getReadingActivity: mocks.activity }));
import { GET } from '@/app/api/reading/activity/route';
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner' }); mocks.activity.mockResolvedValue({ totals: {} }); });
describe('reading activity API', () => {
  it('requires authentication before reading activity', async () => { mocks.session.mockResolvedValue(null); expect((await GET(new NextRequest('http://localhost/api/reading/activity'))).status).toBe(401); expect(mocks.activity).not.toHaveBeenCalled(); });
  it('uses the authenticated owner, validates query values and returns private data', async () => {
    const response = await GET(new NextRequest('http://localhost/api/reading/activity?year=2025&timeZone=America%2FNew_York&userId=other'));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('private, no-store'); expect(mocks.activity).toHaveBeenCalledWith('owner', 2025, 'America/New_York');
  });
  it('rejects invalid years and time zones without querying records', async () => { for (const query of ['year=hello', 'year=2026.5', 'year=1800', 'timeZone=not-a-zone']) expect((await GET(new NextRequest(`http://localhost/api/reading/activity?${query}`))).status).toBe(400); expect(mocks.activity).not.toHaveBeenCalled(); });
});
