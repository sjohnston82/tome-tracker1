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
})

export const createSeriesEntrySchema = z.object({
  workId: z.string().uuid(),
  position: z.number().min(0).max(99999).nullable().optional(),
  entryType: z.enum(['MAIN', 'PREQUEL', 'NOVELLA', 'COMPANION', 'OTHER']).default('MAIN'),
  isConfirmed: z.boolean().default(false),
})
