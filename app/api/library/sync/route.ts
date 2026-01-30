import { withAuth } from '@/lib/api/withAuth'
import { getLibrarySnapshot, getLibraryStats } from '@/lib/library/sync'
import { successResponse, handleApiError } from '@/lib/api/response'

export const GET = withAuth(async (request, session) => {
  try {
    const [snapshot, stats] = await Promise.all([
      getLibrarySnapshot(session.userId),
      getLibraryStats(session.userId),
    ])

    return successResponse({ ...snapshot, stats })
  } catch (error) {
    return handleApiError(error)
  }
})
