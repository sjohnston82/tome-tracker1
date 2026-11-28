// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyPassword } from '@/lib/auth/password';
import { POST } from '@/app/api/auth/password-reset/confirm/route';
if (process.env.RUN_DATABASE_TESTS !== 'true' || !process.env.DATABASE_URL || !['localhost', '127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname)) throw new Error('Reset tests require an explicitly enabled disposable localhost database');
const users: string[] = [];
let owner: string;
beforeEach(async () => { owner = (await prisma.user.create({ data: { email: `reset-${crypto.randomUUID()}@example.test`, passwordHash: 'original' } })).id; users.push(owner); });
afterAll(async () => { await prisma.user.deleteMany({ where: { id: { in: users } } }); await prisma.$disconnect(); });
const token = (expiresAt = new Date(Date.now() + 3600000)) => prisma.passwordResetToken.create({ data: { userId: owner, token: crypto.randomUUID(), expiresAt } });
const confirm = (value: string, password = 'NewPassword123!') => POST(new NextRequest('http://localhost/api/auth/password-reset/confirm', { method: 'POST', body: JSON.stringify({ token: value, password }) }));
describe('single-use account recovery', () => {
  it('changes only the target password, invalidates all its links, and rejects replay', async () => {
    const other = (await prisma.user.create({ data: { email: `other-reset-${crypto.randomUUID()}@example.test`, passwordHash: 'untouched' } })).id; users.push(other);
    const link = await token(); await token();
    expect((await confirm(link.token)).status).toBe(200);
    expect(await verifyPassword('NewPassword123!', (await prisma.user.findUniqueOrThrow({ where: { id: owner } })).passwordHash)).toBe(true);
    expect(await prisma.passwordResetToken.count({ where: { userId: owner } })).toBe(0);
    expect((await confirm(link.token)).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: other } })).passwordHash).toBe('untouched');
  });
  it('rejects expired and missing links without changing passwords', async () => {
    const expired = await token(new Date(Date.now() - 1000));
    expect((await confirm(expired.token)).status).toBe(400); expect((await confirm('missing')).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: owner } })).passwordHash).toBe('original');
  });
  it('allows just one of two simultaneous uses of the same token', async () => {
    const link = await token();
    const responses = await Promise.all([confirm(link.token), confirm(link.token, 'OtherPassword456!')]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 400]);
    expect(await prisma.passwordResetToken.count({ where: { userId: owner } })).toBe(0);
  });
  it('does not consume a link when password validation fails', async () => {
    const link = await token(); expect((await confirm(link.token, 'weak')).status).toBe(400);
    expect(await prisma.passwordResetToken.count({ where: { token: link.token } })).toBe(1);
  });
});
