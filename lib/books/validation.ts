import { z } from 'zod'

export const createBookSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  authorName: z.string().min(1, 'Author is required').max(200),
  isbn13: z.string().length(13).regex(/^\d+$/).optional().nullable(),
  isbn10: z.string().length(10).optional().nullable(),
  publisher: z.string().max(200).optional().nullable(),
  publicationYear: z.number().int().min(1000).max(2100).optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  seriesName: z.string().max(200).optional().nullable(),
  seriesNumber: z.number().positive().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).default([]),
  genres: z.array(z.string().max(50)).max(20).default([]),
  source: z.enum(['SCAN', 'MANUAL', 'IMPORT']),
})

export type CreateBookInput = z.infer<typeof createBookSchema>

export const updateBookSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  authorName: z.string().min(1).max(200).optional(),
  isbn13: z.string().length(13).regex(/^\d+$/).optional().nullable(),
  isbn10: z.string().length(10).optional().nullable(),
  publisher: z.string().max(200).optional().nullable(),
  publicationYear: z.number().int().min(1000).max(2100).optional().nullable(),
  coverUrl: z.string().url().optional().nullable(),
  seriesName: z.string().max(200).optional().nullable(),
  seriesNumber: z.number().positive().optional().nullable(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  genres: z.array(z.string().max(50)).max(20).optional(),
})

export type UpdateBookInput = z.infer<typeof updateBookSchema>
