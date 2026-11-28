export type ProgressEntry = { id: string; page: number; occurredAt: string; createdAt: string; note: string; isCompletion: boolean }
export type ProgressSession = { id: string; baselinePage: number; totalPages: number | null; startedAt: string | null; trackedAt: string; finishedAt: string | null; version: number; logs: ProgressEntry[] }

export function readingProgress(session: Pick<ProgressSession, 'baselinePage' | 'logs' | 'totalPages'>) {
  const ordered = [...session.logs].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  const currentPage = ordered.at(-1)?.page ?? session.baselinePage
  // Corrections or revisiting pages must not count the same pages twice.
  const highWater = Math.max(session.baselinePage, ...ordered.map(log => log.page))
  return { currentPage, pagesLogged: highWater - session.baselinePage, percent: session.totalPages ? Math.min(100, Math.round(currentPage / session.totalPages * 100)) : null, lastLog: ordered.at(-1) ?? null }
}
