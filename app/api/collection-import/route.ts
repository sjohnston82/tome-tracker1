import { z } from 'zod'
import { withAuth } from '@/lib/api/withAuth'
import { successResponse, errorResponse, handleApiError } from '@/lib/api/response'
import { previewCollectionImport, applyCollectionImport } from '@/lib/import/collection-service'
import { prisma } from '@/lib/db'

export const GET = withAuth(async (_request, session) => {
  try {
    const result = await prisma.collectionImport.findUnique({ where: { userId_dataset: { userId: session.userId, dataset: 'tome-collection' } }, select: { report: true, updatedAt: true } })
    return successResponse({ import: result })
  } catch (error) { return handleApiError(error) }
})

export const POST = withAuth(async (request, session) => {
  // Applying an import must be deliberately enabled for the target environment.
  // Disabled by default, including every production/preview deployment.
  if (process.env.COLLECTION_IMPORT_ENABLED !== 'true') return errorResponse('IMPORT_DISABLED', 'Collection import is not enabled in this environment.', 403)
  try {
    const text = await request.text()
    if (text.length > 5_000_000) return errorResponse('TOO_LARGE', 'Import manifest is too large.', 413)
    let json: unknown
    try { json = JSON.parse(text) } catch { return errorResponse('VALIDATION_ERROR', 'Invalid JSON.', 400) }
    const input = z.object({ mode: z.enum(['preview', 'apply']), manifest: z.unknown() }).parse(json)
    const result = input.mode === 'preview' ? await previewCollectionImport(session.userId, input.manifest) : await applyCollectionImport(session.userId, input.manifest)
    return successResponse(result, result.ready ? 200 : 409)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && ['P2034', 'P2002'].includes(String(error.code))) return errorResponse('IMPORT_CONFLICT', 'The catalog changed during import. Preview and retry.', 409)
    return handleApiError(error)
  }
})
