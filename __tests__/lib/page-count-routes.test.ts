// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), find: vi.fn(), lookup: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }))
vi.mock('@/lib/db', () => ({ prisma: { book: { findFirst: mocks.find } } }))
vi.mock('@/lib/metadata/page-counts', () => ({ lookupPageCounts: mocks.lookup }))
import { GET } from '@/app/api/books/[id]/page-count/route'
const req = () => new NextRequest('http://localhost/api/books/book/page-count')
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner' }) })
describe('page count lookup authorization', () => {
  it('does not call a provider for anonymous users or another user’s book', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
    mocks.session.mockResolvedValue({ userId: 'owner' }); mocks.find.mockResolvedValue(null)
    expect((await GET(req())).status).toBe(404)
    expect(mocks.lookup).not.toHaveBeenCalled()
    expect(mocks.find).toHaveBeenCalledWith({ where: { id: 'book', userId: 'owner' }, include: { author: true } })
  })
  it('uses saved book metadata, supports ISBN10, and performs no writes', async () => {
    mocks.find.mockResolvedValue({ title: 'A Novel', author: { name: 'An Author' }, isbn13: null, isbn10: '123456789X' })
    mocks.lookup.mockResolvedValue({ suggested: 320, options: [], message: 'ISBN match', warnings: [] })
    expect((await GET(req())).status).toBe(200)
    expect(mocks.lookup).toHaveBeenCalledWith('A Novel', 'An Author', '123456789X')
  })
})
