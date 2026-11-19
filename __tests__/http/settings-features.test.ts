// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/auth/password';
const url = process.env.DATABASE_URL;
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Settings HTTP tests require an enabled disposable localhost database');
describe('settings backup/security HTTP flows', () => {
  const originalPassword = 'OriginalPassword123!'; const newPassword = 'ChangedPassword456!';
  let owner: string, other: string, email: string, cookie: string;
  const call = (path: string, method = 'GET', body?: unknown, signed = true, headers = {}) => fetch(`http://localhost:3000${path}`, { method, headers: { ...(signed ? { Cookie: cookie } : {}), 'Content-Type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  beforeAll(async () => {
    email = `settings-features-${crypto.randomUUID()}@example.test`;
    owner = (await prisma.user.create({ data: { email, passwordHash: await hashPassword(originalPassword) } })).id;
    other = (await prisma.user.create({ data: { email: `settings-private-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } })).id;
    const author = await prisma.author.create({ data: { userId: other, name: 'Must Not Be Exported', books: { create: { userId: other, title: 'Other Account Private Book', source: 'MANUAL' } } } });
    expect(author.id).toBeTruthy();
    const response = await call('/api/auth/login', 'POST', { email, password: originalPassword }, false);
    expect(response.status).toBe(200); cookie = response.headers.get('set-cookie')!.split(';')[0];
  });
  afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: [owner, other].filter(Boolean) } } }); await prisma.$disconnect(); });
  it('requires authentication for backup, restore, security changes and cover proxy', async () => {
    for (const [path, method] of [['/api/account/backup', 'GET'], ['/api/account/backup', 'POST'], ['/api/account/security', 'PATCH'], ['/api/account/cover-download?url=https://example.test/cover', 'GET']]) expect((await call(path, method, method === 'GET' ? undefined : {}, false)).status).toBe(401);
  });
  it('exports only the signed-in account and validates backup confirmation/schema/size', async () => {
    const response = await call('/api/account/backup'); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    const backup = await response.json(); expect(backup.books).toEqual([]); expect(JSON.stringify(backup)).not.toContain('Other Account');
    expect((await call('/api/account/backup?preview=1', 'POST', backup)).status).toBe(200);
    expect((await call('/api/account/backup', 'POST', backup)).status).toBe(400);
    expect((await call('/api/account/backup', 'POST', { ...backup, version: 2 }, true, { 'X-Confirm-Restore': 'yes' })).status).toBe(400);
    expect((await call('/api/account/backup', 'POST', backup, true, { 'X-Confirm-Restore': 'yes' })).status).toBe(200);
    expect((await call('/api/account/cover-download?url=http://127.0.0.1/private')).status).toBe(400);
  });
  it('rejects wrong current credentials and weak new passwords, then updates login and revokes old sessions', async () => {
    expect((await call('/api/account/security', 'PATCH', { currentPassword: 'wrong', email: 'changed@example.test' })).status).toBe(403);
    expect((await call('/api/account/security', 'PATCH', { currentPassword: originalPassword, newPassword: 'weak' })).status).toBe(400);
    const changedEmail = `changed-${crypto.randomUUID()}@example.test`;
    const response = await call('/api/account/security', 'PATCH', { currentPassword: originalPassword, email: changedEmail, newPassword });
    expect(response.status).toBe(200);
    expect((await call('/api/account')).status).toBe(401); // previous cookie revoked
    cookie = response.headers.get('set-cookie')!.split(';')[0];
    expect((await (await call('/api/account')).json()).user.email).toBe(changedEmail);
    expect((await call('/api/auth/login', 'POST', { email: changedEmail, password: originalPassword }, false)).status).toBe(401);
    expect((await call('/api/auth/login', 'POST', { email: changedEmail, password: newPassword }, false)).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: other } })).not.toBeNull();
  });
});
