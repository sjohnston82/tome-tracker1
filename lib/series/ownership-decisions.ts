import { z } from 'zod'
export const OWNERSHIP_DATASET = 'tome:ownership-review'
export const exclusionSchema = z.object({ version: z.literal(1), exclusions: z.array(z.object({ workId: z.string().min(1).max(100), bookId: z.string().min(1).max(100) }).strict()).max(100000) }).strict().refine(report => new Set(report.exclusions.map(pair => JSON.stringify([pair.workId, pair.bookId]))).size === report.exclusions.length, 'Duplicate ownership decision.')
export type OwnershipExclusion = { workId: string; bookId: string }
export function readOwnershipExclusions(report: unknown): OwnershipExclusion[] {
  const result = exclusionSchema.safeParse(report)
  if (!result.success) throw new Error('Ownership decisions could not be read safely. Restore a valid backup or contact support.')
  return result.data.exclusions
}
export function remapOwnershipReport(report: unknown, works: Map<string, string>, books: Map<string, string>) {
  return { version: 1, exclusions: readOwnershipExclusions(report).flatMap(pair => works.has(pair.workId) && books.has(pair.bookId) ? [{ workId: works.get(pair.workId)!, bookId: books.get(pair.bookId)! }] : []) }
}
