import { z } from 'zod'

export const createSeriesSchema = z.object({
  name: z.string().trim().min(1).max(250),
  description: z.string().max(4000).nullable().optional(),
})

export const createWorkSchema = z.object({
  title: z.string().trim().min(1).max(500),
  authorName: z.string().trim().min(1).max(250),
  openLibraryId: z.string().max(100).nullable().optional(),
  hardcoverId: z.string().max(100).nullable().optional(),
  publicationYear: z.number().int().min(1).max(9999).nullable().optional(),
})

export const createSeriesEntrySchema = z.object({
  workId: z.string().uuid(),
  position: z.number().min(0).max(99999.999).multipleOf(0.001).nullable().optional(),
  entryType: z.enum(['MAIN', 'PREQUEL', 'NOVELLA', 'COMPANION', 'OTHER']).default('MAIN'),
  isConfirmed: z.boolean().default(false),
})

const nonEmpty = (input: object) => Object.keys(input).length > 0
export const updateSeriesSchema = createSeriesSchema.partial().refine(nonEmpty, 'Provide at least one change')
export const updateWorkSchema = createWorkSchema.partial().refine(nonEmpty, 'Provide at least one change')
export const updateSeriesEntrySchema = createSeriesEntrySchema.omit({ workId: true }).partial().refine(nonEmpty, 'Provide at least one change')
