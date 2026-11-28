// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ session: vi.fn(), get: vi.fn(), record: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }))
vi.mock('@/lib/reading/service', async original => ({ ...await original<typeof import('@/lib/reading/service')>(), getReading: mocks.get, recordReading: mocks.record }))
import { GET, POST } from '@/app/api/books/[id]/reading/route'
import { ReadingError } from '@/lib/reading/service'
const req = (body?: unknown) => new NextRequest('http://localhost/api/books/book/reading', { method: body ? 'POST' : 'GET', body: body ? JSON.stringify(body) : undefined })
beforeEach(() => { vi.clearAllMocks(); mocks.session.mockResolvedValue({ userId: 'owner' }); mocks.get.mockResolvedValue({ session: null }); mocks.record.mockResolvedValue({ session: {} }) })
describe('reading API safety', () => {
  it('requires a session for reads and changes', async () => {
    mocks.session.mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
    expect((await POST(req({ action: 'start' }))).status).toBe(401)
    expect(mocks.record).not.toHaveBeenCalled()
  })
  it('passes only the signed-in user to reading services', async () => {
    expect((await GET(req())).status).toBe(200)
    expect(mocks.get).toHaveBeenCalledWith('owner', 'book')
    expect((await POST(req({ action: 'start', page: 224, userId: 'other' }))).status).toBe(200)
    expect(mocks.record).toHaveBeenCalledWith('owner', 'book', { action: 'start', page: 224, totalPages: null })
  })
  it('returns ownership errors and concurrency conflicts without partial success', async () => {
    mocks.get.mockResolvedValue(null)
    expect((await GET(req())).status).toBe(404)
    mocks.record.mockRejectedValue(new ReadingError(404, 'Book not found.'))
    expect((await POST(req({ action: 'start' }))).status).toBe(404)
    mocks.record.mockRejectedValue({ code: 'P2034' })
    expect((await POST(req({ action: 'start' }))).status).toBe(409)
  })
})
