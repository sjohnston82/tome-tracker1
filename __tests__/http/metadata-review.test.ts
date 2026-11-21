// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createToken } from '@/lib/auth/jwt';
import { applyCollectionImport } from '@/lib/import/collection-service';
import { collectionFixture, bookKey } from '../fixtures/collection';
if (process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).hostname !== 'localhost') throw new Error('Review HTTP tests require an explicitly enabled disposable localhost database');
let owner: string, other: string, cookie: string, otherCookie: string, bookId: string;
const call = (method = 'GET', body?: unknown, token = cookie) => fetch('http://localhost:3000/api/metadata-review', { method, headers: { 'Content-Type': 'application/json', ...(token ? { Cookie: token } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
beforeAll(async () => {
  for (const foreign of [false, true]) {
    const user = await prisma.user.create({ data: { email: `review-http-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } }); const token = `session=${await createToken({ userId: user.id, email: user.email, role: 'USER' })}`;
    if (foreign) { other = user.id; otherCookie = token; } else { owner = user.id; cookie = token; }
  }
  const manifest = collectionFixture(); manifest.books[0].publicationYear = 1952; await applyCollectionImport(owner, manifest);
  const book = await prisma.book.findUniqueOrThrow({ where: { userId_importKey: { userId: owner, importKey: bookKey } } }); bookId = book.id;
  await prisma.book.update({ where: { id: bookId }, data: { publicationYear: 2005 } });
});
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other] } } }); await prisma.$disconnect(); });
describe('metadata review HTTP actions', () => {
  it('requires authentication, scopes reads privately and renders the review page', async () => {
    expect((await call('GET', undefined, '')).status).toBe(401); const response = await call(); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    expect((await (await call('GET', undefined, otherCookie)).json()).items).toEqual([]);
    expect((await fetch('http://localhost:3000/library/review', { headers: { Cookie: cookie } })).status).toBe(200);
  });
  it('persists keep/reopen choices, prevents cross-account decisions and applies only a confirmed source field', async () => {
    let item = (await (await call()).json()).items.find((item: any) => item.code === 'PUBLICATION_CONFLICT' && item.href.includes(bookId));
    expect((await call('PATCH', { id: item.id, version: item.version, action: 'keep' }, otherCookie)).status).toBe(404);
    expect((await call('PATCH', { id: item.id, version: item.version, action: 'keep' })).status).toBe(200);
    item = (await (await call()).json()).items.find((row: any) => row.id === item.id); expect(item.resolved).toBe(true);
    expect((await call('PATCH', { id: item.id, version: item.version, action: 'reopen' })).status).toBe(200);
    item = (await (await call()).json()).items.find((row: any) => row.id === item.id);
    expect((await call('PATCH', { id: item.id, version: item.version, action: 'source' })).status).toBe(200);
    expect((await prisma.book.findUniqueOrThrow({ where: { id: bookId } })).publicationYear).toBe(1952); expect(await prisma.book.count({ where: { userId: owner } })).toBe(1);
  });
});
