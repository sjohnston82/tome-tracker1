// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), update: vi.fn(), search: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }))
vi.mock('@/lib/db', () => ({ prisma: { book: { findFirst: mocks.find, updateMany: mocks.update } } }))
vi.mock('@/lib/metadata/cover-options', async original => ({ ...await original<typeof import('@/lib/metadata/cover-options')>(), searchCoverOptions: mocks.search }))
import { GET, PATCH } from '@/app/api/books/[id]/covers/route'
const req = (method = 'GET', body?: unknown, query = '') => new NextRequest(`http://localhost/api/books/book/covers${query}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'Content-Type': 'application/json' } })
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner' }); mocks.find.mockResolvedValue({ title: 'A Novel', author: { name: 'An Author' }, isbn13: '9780000000001' }); mocks.update.mockResolvedValue({ count: 1 }); mocks.search.mockResolvedValue({ options: [], warnings: [] }) })
describe('cover picker authorization and persistence', () => {
  it('rejects anonymous searches and saves', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
    expect((await PATCH(req('PATCH', { coverUrl: null }))).status).toBe(401)
    expect(mocks.search).not.toHaveBeenCalled()
  })
  it('does not search providers for another user’s book', async () => {
    mocks.find.mockResolvedValue(null)
    expect((await GET(req())).status).toBe(404)
    expect(mocks.find).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'book', userId: 'owner' } }))
    expect(mocks.search).not.toHaveBeenCalled()
  })
  it('uses the owned ISBN initially and drops it when the user edits search terms', async () => {
    await GET(req())
    expect(mocks.search).toHaveBeenLastCalledWith('A Novel', 'An Author', '9780000000001')
    await GET(req('GET', undefined, '?title=Different&author='))
    expect(mocks.search).toHaveBeenLastCalledWith('Different', '', null)
  })
  it('locks both chosen covers and deliberate removals to the signed-in user', async () => {
    for (const coverUrl of ['https://covers.openlibrary.org/b/id/42-L.jpg?default=false', null]) {
      expect((await PATCH(req('PATCH', { coverUrl }))).status).toBe(200)
      expect(mocks.update).toHaveBeenLastCalledWith({ where: { id: 'book', userId: 'owner' }, data: { coverUrl, coverLocked: true } })
    }
    mocks.update.mockResolvedValue({ count: 0 })
    expect((await PATCH(req('PATCH', { coverUrl: null }))).status).toBe(404)
  })
  it('rejects arbitrary hosts, credentials and malformed input before writing', async () => {
    for (const coverUrl of ['https://example.com/cover.jpg', 'https://covers.openlibrary.org.evil.example/b/id/42-L.jpg', 'https://me:secret@covers.openlibrary.org/b/id/42-L.jpg', 'http://covers.openlibrary.org/b/id/42-L.jpg']) expect((await PATCH(req('PATCH', { coverUrl }))).status).toBe(400)
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
