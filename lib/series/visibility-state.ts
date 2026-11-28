import { createHash } from 'node:crypto'
import type { ManagementState } from './management-state'
import type { ChecklistSeries, ShelfMode } from './checklist'
export function decorateVisibility(catalog: ChecklistSeries[], state: ManagementState): ChecklistSeries[] {
  return catalog.map(series => {
    const ids = [...new Set(series.sourceSeriesIds ?? [series.id])].sort()
    const preferences = state.visibility.filter(item => ids.includes(item.seriesId)).sort((a, b) => a.seriesId.localeCompare(b.seriesId))
    const visibility: ShelfMode = preferences.some(item => item.mode === 'hidden') ? 'hidden' : preferences.some(item => item.mode === 'following') ? 'following' : 'automatic'
    return { ...series, visibility, visibilityVersion: createHash('sha256').update(JSON.stringify({ ids, preferences })).digest('hex') }
  })
}
