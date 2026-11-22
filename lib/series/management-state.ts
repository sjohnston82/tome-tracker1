import { z } from 'zod'
import type { ChecklistSeries } from './checklist'
export const MANAGEMENT_DATASET = 'tome:series-management'
const id = z.string().min(1).max(100)
const group = z.object({ seriesId: id, mode: z.enum(['combined', 'separate']), primaryWorkId: id, workIds: z.array(id).min(2).max(1000) }).strict().refine(value => value.workIds.includes(value.primaryWorkId) && new Set(value.workIds).size === value.workIds.length)
export const managementSchema = z.object({ version: z.literal(1), redirects: z.array(z.object({ name: z.string().trim().min(1).max(250), targetId: id }).strict()).max(10000), groups: z.array(group).max(20000) }).strict().superRefine((value, ctx) => {
  if (new Set(value.redirects.map(item => seriesNameKey(item.name))).size !== value.redirects.length) ctx.addIssue({ code: 'custom', message: 'Duplicate series redirect.' })
  const keys = value.groups.flatMap(item => item.workIds.map(workId => `${item.seriesId}:${workId}`))
  if (new Set(keys).size !== keys.length) ctx.addIssue({ code: 'custom', message: 'Overlapping work groups.' })
})
export type ManagementState = z.infer<typeof managementSchema>
export const seriesNameKey = (name: string) => name.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
export function readManagementState(report?: unknown): ManagementState {
  if (report === undefined) return { version: 1, redirects: [], groups: [] }
  return managementSchema.parse(report)
}
export function remapManagementState(report: unknown, series: Map<string, string>, works: Map<string, string>): ManagementState {
  const state = readManagementState(report)
  return { version: 1, redirects: state.redirects.flatMap(item => series.has(item.targetId) ? [{ ...item, targetId: series.get(item.targetId)! }] : []), groups: state.groups.flatMap(item => {
    const workIds = item.workIds.filter(id => works.has(id)).map(id => works.get(id)!)
    return series.has(item.seriesId) && works.has(item.primaryWorkId) && workIds.length > 1 ? [{ ...item, seriesId: series.get(item.seriesId)!, primaryWorkId: works.get(item.primaryWorkId)!, workIds }] : []
  }) }
}
type Work = ChecklistSeries['entries'][number]['work']
export function applyManagementState(catalog: ChecklistSeries[], works: Work[], state: ManagementState): ChecklistSeries[] {
  const lookup = new Map(works.map(work => [work.id, work]))
  return catalog.map(series => ({ ...series, managed: state.redirects.some(item => item.targetId === series.id), entries: series.entries.flatMap(entry => {
    const group = state.groups.find(item => item.seriesId === series.id && item.workIds.includes(entry.work.id))
    if (!group) return [entry]
    if (group.mode === 'separate') return [{ ...entry, keepSeparate: true }]
    if (group.primaryWorkId !== entry.work.id) return []
    return group.workIds.flatMap(id => {
      const work = lookup.get(id)
      if (!work) return []
      return [{ ...entry, ownershipWorkIds: [id], ownershipLinks: [...work.editions.map(book => ({ bookId: book.id, workId: id, source: 'edition' as const })), ...work.containedIn.map(link => ({ bookId: link.book.id, workId: id, source: 'content' as const }))], work: { ...work, title: entry.work.title, authorName: entry.work.authorName, publicationYear: entry.work.publicationYear } }]
    }).sort((a, b) => Number(b.work.id === group.primaryWorkId) - Number(a.work.id === group.primaryWorkId))
  }) }))
}
