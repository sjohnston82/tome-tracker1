import { checklistStats, type ChecklistSeries } from './checklist'
export function isSeriesVisible(series: ChecklistSeries, options: { showUnowned: boolean; showHidden: boolean; selected: string | null }): boolean {
  if (series.visibility === 'hidden') return options.showHidden
  return options.showUnowned || series.visibility === 'following' || series.id === options.selected || checklistStats(series).owned > 0
}
