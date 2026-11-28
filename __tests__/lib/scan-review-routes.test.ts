// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
const mocks = vi.hoisted(() => ({ session: vi.fn(), matches: vi.fn(), link: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }));
vi.mock('@/lib/books/scan-service', () => ({ findScanMatches: mocks.matches, linkScannedIsbn: mocks.link }));
import { POST } from '@/app/api/scan/matches/route';
import { PATCH } from '@/app/api/books/[id]/isbn/route';
const id = '12345678-1234-4234-8234-123456789012';
const input = { isbn: '9780553579901', expectedUpdatedAt: '2026-11-21T12:00:00.000Z' };
const req = (path: string, body: unknown, method = 'POST') => new NextRequest(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner' }); mocks.matches.mockResolvedValue({ matches: [], totalMatches: 0, exactCount: 0 }); mocks.link.mockResolvedValue({ bookId: id, isbn13: input.isbn, alreadyLinked: false }); });
describe('scan review route security', () => {
  it('rejects anonymous matching and linking before any lookup or mutation', async () => {
    mocks.session.mockResolvedValue(null); expect((await POST(req('/api/scan/matches', { isbn: input.isbn }))).status).toBe(401);
    expect((await PATCH(req(`/api/books/${id}/isbn`, input, 'PATCH'))).status).toBe(401);
    expect(mocks.matches).not.toHaveBeenCalled(); expect(mocks.link).not.toHaveBeenCalled();
  });
  it('scopes matching to the session owner and prevents cached account results', async () => {
    const response = await POST(req('/api/scan/matches', { isbn: input.isbn, title: 'A Clash of Kings', authors: ['George R. R. Martin'] }));
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    expect(mocks.matches).toHaveBeenCalledWith('owner', expect.objectContaining({ isbn: input.isbn }));
  });
  it('rejects invalid inputs and arbitrary metadata writes on the ISBN-only endpoint', async () => {
    for (const body of [{ ...input, title: 'Overwrite title' }, { ...input, isbn: '030640615200' }, { isbn: input.isbn }]) expect((await PATCH(req(`/api/books/${id}/isbn`, body, 'PATCH'))).status).toBe(400);
    expect((await POST(req('/api/scan/matches', {}))).status).toBe(400); expect(mocks.link).not.toHaveBeenCalled(); expect(mocks.matches).not.toHaveBeenCalled();
  });
  it('returns a private not-found for other users’ books and exposes only owner-scoped conflicts', async () => {
    mocks.link.mockResolvedValueOnce({ error: 'NOT_FOUND' }); expect((await PATCH(req(`/api/books/${id}/isbn`, input, 'PATCH'))).status).toBe(404);
    expect(mocks.link).toHaveBeenCalledWith('owner', id, input.isbn, input.expectedUpdatedAt);
    mocks.link.mockResolvedValueOnce({ error: 'ISBN_IN_USE', existingBookId: 'owned-copy' });
    const response = await PATCH(req(`/api/books/${id}/isbn`, input, 'PATCH')); expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error_code: 'ISBN_IN_USE', details: { existingBookId: 'owned-copy' } });
    for (const error of ['DIFFERENT_ISBN', 'STALE_BOOK']) { mocks.link.mockResolvedValueOnce({ error }); expect((await PATCH(req(`/api/books/${id}/isbn`, input, 'PATCH'))).status).toBe(409); }
  });
});
