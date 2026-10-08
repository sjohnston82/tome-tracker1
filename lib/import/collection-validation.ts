import { z } from 'zod'

const sourceKey = z.string().regex(/^(book|work|series):[a-f0-9]{64}$/)
const year = z.number().int().min(1).max(9999).nullable()
const status = z.enum(['UNKNOWN', 'UNREAD', 'READING', 'READ'])
const identity = { title: z.string().trim().min(1).max(500), authorName: z.string().trim().min(1).max(250), publicationYear: year }
const source = z.object({ file: z.string().max(250), row: z.number().int().positive(), sheet: z.string().max(250).optional(), heading: z.string().max(500).optional() })
export const collectionManifestSchema = z.object({
  version: z.literal(1),
  dataset: z.literal('tome-collection'),
  sourceHashes: z.object({ xlsx: z.string().regex(/^[a-f0-9]{64}$/), docx: z.string().regex(/^[a-f0-9]{64}$/) }),
  expected: z.object({ owned: z.number().int().min(1).max(5000), statuses: z.object({ UNKNOWN: z.number().int().nonnegative(), UNREAD: z.number().int().nonnegative(), READING: z.number().int().nonnegative(), READ: z.number().int().nonnegative() }) }),
  books: z.array(z.object({ sourceKey, ...identity, seriesName: z.string().max(250).nullable(), readingStatus: status, source })).min(1).max(5000),
  series: z.array(z.object({ name: z.string().trim().min(1).max(250), sourceKey, entries: z.array(z.object({
    sourceKey, ...identity, position: z.number().min(0).max(99999.999).multipleOf(0.001).nullable(),
    entryType: z.enum(['MAIN', 'PREQUEL', 'NOVELLA', 'COMPANION', 'OTHER']),
    ownedSourceKeys: z.array(sourceKey).max(100), sourceOwnership: z.string().max(500), source,
  })).max(1000) })).max(500),
  review: z.array(z.object({ code: z.string().max(100), sourceKey, message: z.string().max(4000), seriesName: z.string().max(250).optional(), title: z.string().max(500).optional(), candidateKeys: z.array(sourceKey).max(100).optional() })).max(10000),
}).superRefine((manifest, ctx) => {
  const seen = new Set<string>()
  const counts = { UNKNOWN: 0, UNREAD: 0, READING: 0, READ: 0 }
  for (const b of manifest.books) {
    if (!b.sourceKey.startsWith('book:') || seen.has(b.sourceKey)) ctx.addIssue({ code: 'custom', message: 'Duplicate or invalid owned source key' })
    seen.add(b.sourceKey)
    counts[b.readingStatus]++
  }
  if (manifest.expected.owned !== manifest.books.length || Object.keys(counts).some(k => counts[k as keyof typeof counts] !== manifest.expected.statuses[k as keyof typeof counts])) ctx.addIssue({ code: 'custom', message: 'Source ownership/status counts do not reconcile' })
  const seriesNames = new Set<string>()
  for (const s of manifest.series) {
    const name = s.name.toLocaleLowerCase()
    if (seriesNames.has(name)) ctx.addIssue({ code: 'custom', message: 'Duplicate series name' })
    seriesNames.add(name)
    const workKeys = new Set<string>()
    for (const e of s.entries) {
      if (!e.sourceKey.startsWith('work:') || workKeys.has(e.sourceKey)) ctx.addIssue({ code: 'custom', message: 'Duplicate or invalid work membership' })
      workKeys.add(e.sourceKey)
      if (e.ownedSourceKeys.some(k => !seen.has(k))) ctx.addIssue({ code: 'custom', message: 'Work references an unknown physical book' })
    }
  }
})

export type CollectionManifest = z.infer<typeof collectionManifestSchema>
