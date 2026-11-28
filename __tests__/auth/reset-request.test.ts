// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const { user, create, remove, send, rate } = vi.hoisted(() => ({ user: vi.fn(), create: vi.fn(), remove: vi.fn(), send: vi.fn(), rate: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: user }, passwordResetToken: { create, deleteMany: remove } } }));
vi.mock('@/lib/email/resend', () => ({ sendPasswordResetEmail: send }));
vi.mock('@/lib/api/response', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/api/response')>(), checkRateLimit: rate }));
import { POST } from '@/app/api/auth/password-reset/request/route';
const request = (email = 'reader@example.test') => POST(new NextRequest('https://books.example/api/auth/password-reset/request', { method: 'POST', body: JSON.stringify({ email }) }));
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('RESEND_API_KEY', 'test-key'); vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@books.example'); vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://books.example');
  rate.mockReturnValue({ allowed: true }); user.mockResolvedValue({ id: 'reader' }); create.mockResolvedValue({ id: 'new-token' }); send.mockResolvedValue(true); remove.mockResolvedValue({ count: 1 });
});
afterEach(() => vi.unstubAllEnvs());
describe('password reset requests', () => {
  it('reports missing configuration before looking up any account', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const known = await request(), unknown = await request('unknown@example.test');
    expect(known.status).toBe(503); expect(await known.json()).toEqual(await unknown.json()); expect(user).not.toHaveBeenCalled(); expect(create).not.toHaveBeenCalled();
  });
  it('returns the same response for existing and unknown users without exposing a token', async () => {
    const known = await request(); user.mockResolvedValue(null); const unknown = await request('unknown@example.test');
    expect(known.status).toBe(200); expect(await known.json()).toEqual(await unknown.json()); expect(create).toHaveBeenCalledTimes(1);
    const token = create.mock.calls[0][0].data.token;
    expect(token).toMatch(/^[a-f0-9]{64}$/); expect(send).toHaveBeenCalledWith('reader@example.test', `https://books.example/reset-password?token=${token}`);
    expect(remove).not.toHaveBeenCalled();
  });
  it('removes only the undelivered token and preserves older recovery links', async () => {
    send.mockResolvedValue(false); const response = await request();
    expect(response.status).toBe(200); expect(remove).toHaveBeenCalledExactlyOnceWith({ where: { id: 'new-token' } });
    expect(await response.text()).not.toContain('new-token');
  });
  it('rate limits before looking up accounts or creating tokens', async () => {
    rate.mockReturnValue({ allowed: false }); expect((await request()).status).toBe(429); expect(user).not.toHaveBeenCalled(); expect(send).not.toHaveBeenCalled();
  });
});
