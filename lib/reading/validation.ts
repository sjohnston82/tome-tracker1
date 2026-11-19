import { z } from 'zod'
const page = z.number().int().min(0).max(1000000)
const versioned = { sessionId: z.string().uuid(), version: z.number().int().nonnegative() }
const entry = { page, occurredAt: z.string().datetime({ offset: true }), note: z.string().max(2000).default('') }
export const readingInput = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start'), page: page.default(0), totalPages: z.number().int().positive().max(1000000).nullable().default(null) }),
  z.object({ action: z.literal('log'), ...versioned, ...entry, requestId: z.string().uuid(), finish: z.boolean().default(false) }),
  z.object({ action: z.literal('edit'), ...versioned, ...entry, entryId: z.string().uuid() }),
  z.object({ action: z.literal('delete'), ...versioned, entryId: z.string().uuid() }),
  z.object({ action: z.literal('settings'), ...versioned, totalPages: z.number().int().positive().max(1000000).nullable(), baselinePage: page }),
])
export type ReadingInput = z.infer<typeof readingInput>
