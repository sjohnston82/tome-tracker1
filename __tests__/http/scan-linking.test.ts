// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createToken } from '@/lib/auth/jwt';
if (process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).hostname !== 'localhost') throw new Error('Scan HTTP tests require an explicitly enabled disposable localhost database');
let owner: string, other: string, cookie: string, bookId: string, foreignId: string;
const call = (path: string, body: unknown, method = 'POST', signed = true) => fetch(`http://localhost:3000${path}`, { method, headers: { 'Content-Type': 'application/json', ...(signed ? { Cookie: cookie } : {}) }, body: JSON.stringify(body) });
beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: `scan-http-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } }); owner = user.id;
  other = (await prisma.user.create({ data: { email: `scan-http-other-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id;
  cookie = `session=${await createToken({ userId: owner, email: user.email, role: 'USER' })}`;
  for (const userId of [owner, other]) {
    const author = await prisma.author.create({ data: { userId, name: 'Ayn Rand' } });
    const book = await prisma.book.create({ data: { userId, authorId: author.id, title: 'We the Living', readingStatus: 'READ', coverLocked: true, source: 'IMPORT' } });
    if (userId === owner) bookId = book.id; else foreignId = book.id;
  }
});
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } }); await prisma.$disconnect(); });
describe('scan review HTTP workflow', () => {
  it('requires authentication and hides another user’s copy', async () => {
    expect((await call('/api/scan/matches', { isbn: '9780451187840' }, 'POST', false)).status).toBe(401);
    expect((await call(`/api/books/${foreignId}/isbn`, { isbn: '9780451187840', expectedUpdatedAt: new Date().toISOString() }, 'PATCH')).status).toBe(404);
  });
  it('suggests an imported copy, links its ISBN explicitly, and recognizes it on the next scan without adding records', async () => {
    const input = { isbn: '9780451187840', title: 'We the Living', authors: ['Ayn Rand'] };
    const response = await call('/api/scan/matches', input); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    const review = await response.json(); expect(review.exactCount).toBe(0); expect(review.matches).toHaveLength(1); expect(review.matches[0]).toMatchObject({ id: bookId, canLink: true });
    const body = { isbn: input.isbn, expectedUpdatedAt: review.matches[0].updatedAt };
    expect((await call(`/api/books/${bookId}/isbn`, body, 'PATCH')).status).toBe(200);
    const again = await (await call('/api/scan/matches', { isbn: input.isbn })).json(); expect(again.exactCount).toBe(1); expect(again.matches[0].id).toBe(bookId);
    expect((await call(`/api/books/${bookId}/isbn`, body, 'PATCH')).status).toBe(200);
    expect(await prisma.book.count({ where: { userId: owner } })).toBe(1);
    expect(await prisma.book.findUnique({ where: { id: bookId } })).toMatchObject({ readingStatus: 'READ', coverLocked: true, title: 'We the Living' });
  });
});
