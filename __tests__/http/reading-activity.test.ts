// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { createToken } from '@/lib/auth/jwt';
const url = process.env.DATABASE_URL;
if (process.env.RUN_DATABASE_TESTS !== 'true' || !url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname)) throw new Error('Activity HTTP tests require an enabled disposable localhost database');
describe('reading activity HTTP', () => {
  let owner: string, cookie: string;
  const call = (path: string, signed = true) => fetch(`http://localhost:3000${path}`, { headers: signed ? { Cookie: cookie } : {} });
  beforeAll(async () => {
    const user = await prisma.user.create({ data: { email: `activity-http-${crypto.randomUUID()}@example.test`, passwordHash: 'test-only' } }); owner = user.id;
    cookie = `session=${await createToken({ userId: owner, email: user.email, role: 'USER' })}`;
    const author = await prisma.author.create({ data: { userId: owner, name: 'Activity Test Author' } });
    const book = await prisma.book.create({ data: { userId: owner, authorId: author.id, title: 'Activity Test Novel', source: 'MANUAL', readingStatus: 'READ' } });
    await prisma.readingSession.create({ data: { bookId: book.id, baselinePage: 100, finishedAt: new Date('2025-01-01T00:30:00Z'), logs: { create: { requestId: crypto.randomUUID(), page: 125, occurredAt: new Date('2025-01-01T00:30:00Z'), note: 'Private reading note, not analytics output' } } } });
  });
  afterAll(async () => { if (owner) await prisma.user.deleteMany({ where: { id: owner } }); await prisma.$disconnect(); });
  it('requires authentication and serves an account-scoped, private calendar summary', async () => {
    expect((await call('/api/reading/activity', false)).status).toBe(401);
    const response = await call('/api/reading/activity?year=2024&timeZone=America%2FNew_York&userId=other'); expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toContain('no-store');
    const body = await response.json(); expect(body.totals).toMatchObject({ pages: 25, books: 1 }); expect(body.months[11].pages).toBe(25); expect(body.quarters[3].finished[0].day).toBe('2024-12-31'); expect(JSON.stringify(body)).not.toContain('Private reading note');
    expect((await call('/activity')).status).toBe(200);
  });
  it('rejects malformed filters and uses the requested year’s actual dates', async () => {
    expect((await call('/api/reading/activity?timeZone=wrong')).status).toBe(400); expect((await call('/api/reading/activity?year=NaN')).status).toBe(400);
    const utc = await (await call('/api/reading/activity?year=2025&timeZone=UTC')).json(); expect(utc.totals.pages).toBe(25); expect(utc.months[0].books).toBe(1);
  });
});
