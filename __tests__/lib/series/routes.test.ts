// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({ session: vi.fn(), findWork: vi.fn(), lookup: vi.fn(), updateWork: vi.fn(), linkEdition: vi.fn(), unlinkEdition: vi.fn(), preview: vi.fn(), apply: vi.fn(), findImport: vi.fn() }))
vi.mock('@/lib/auth/session', () => ({ getSession: mocks.session }))
vi.mock('@/lib/db', () => ({ prisma: { work: { findFirst: mocks.findWork }, collectionImport: { findUnique: mocks.findImport } } }))
vi.mock('@/lib/series/service', () => ({ updateWork: mocks.updateWork, linkEdition: mocks.linkEdition, unlinkEdition: mocks.unlinkEdition }))
vi.mock('@/lib/series/metadata', () => ({ lookupWorkMetadata: mocks.lookup }))
vi.mock('@/lib/import/collection-service', () => ({ previewCollectionImport: mocks.preview, applyCollectionImport: mocks.apply }))

import { GET as metadata } from '@/app/api/works/[id]/metadata/route'
import { PATCH as patchWork } from '@/app/api/works/[id]/route'
import { POST as link, DELETE as unlink } from '@/app/api/works/[id]/editions/route'
import { POST as importCollection } from '@/app/api/collection-import/route'

const id = '11111111-1111-4111-8111-111111111111'
const req = (path: string, method = 'GET', body?: unknown) => new NextRequest(`http://localhost${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })

describe('series and collection HTTP authorization', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); mocks.session.mockResolvedValue(null) })
  it('rejects unauthenticated metadata, edits, ownership links, and imports', async () => {
    for (const [handler, request] of [[metadata, req(`/api/works/${id}/metadata`)], [patchWork, req(`/api/works/${id}`, 'PATCH', { title: 'Changed' })], [link, req(`/api/works/${id}/editions`, 'POST', { bookId: id })], [unlink, req(`/api/works/${id}/editions`, 'DELETE', { bookId: id })], [importCollection, req('/api/collection-import', 'POST', {})]] as const) expect((await handler(request)).status).toBe(401)
    expect(mocks.lookup).not.toHaveBeenCalled(); expect(mocks.apply).not.toHaveBeenCalled()
  })
  it('does not query a metadata provider for another user’s work', async () => {
    mocks.session.mockResolvedValue({ userId: 'owner', role: 'USER' }); mocks.findWork.mockResolvedValue(null)
    expect((await metadata(req(`/api/works/${id}/metadata`))).status).toBe(404)
    expect(mocks.findWork).toHaveBeenCalledWith(expect.objectContaining({ where: { id, userId: 'owner' } }))
    expect(mocks.lookup).not.toHaveBeenCalled()
  })
  it('returns 404 for cross-user work edits and links', async () => {
    mocks.session.mockResolvedValue({ userId: 'owner', role: 'USER' }); mocks.updateWork.mockResolvedValue(null); mocks.linkEdition.mockResolvedValue(null)
    expect((await patchWork(req(`/api/works/${id}`, 'PATCH', { title: 'Changed' }))).status).toBe(404)
    expect((await link(req(`/api/works/${id}/editions`, 'POST', { bookId: id }))).status).toBe(404)
    expect(mocks.linkEdition).toHaveBeenCalledWith('owner', id, id)
  })
  it('keeps collection writes disabled unless explicitly enabled', async () => {
    mocks.session.mockResolvedValue({ userId: 'owner', role: 'USER' })
    vi.stubEnv('COLLECTION_IMPORT_ENABLED', '')
    expect((await importCollection(req('/api/collection-import', 'POST', { mode: 'apply', manifest: {} }))).status).toBe(403)
    expect(mocks.apply).not.toHaveBeenCalled()
  })
  it('previews with the authenticated user and does not call apply', async () => {
    mocks.session.mockResolvedValue({ userId: 'owner', role: 'USER' }); vi.stubEnv('COLLECTION_IMPORT_ENABLED', 'true')
    mocks.preview.mockResolvedValue({ ready: false, issues: [{ code: 'AMBIGUOUS_EDITION' }] })
    expect((await importCollection(req('/api/collection-import', 'POST', { mode: 'preview', manifest: { version: 1 } }))).status).toBe(409)
    expect(mocks.preview).toHaveBeenCalledWith('owner', { version: 1 })
    expect(mocks.apply).not.toHaveBeenCalled()
  })
})
