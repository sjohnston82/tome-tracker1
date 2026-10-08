import { z } from 'zod'
import { normalizeCollectionIdentity } from '@/lib/import/collection-plan'

const documentSchema = z.object({ key: z.string(), title: z.string(), author_name: z.array(z.string()).default([]), first_publish_year: z.number().int().min(1).max(9999).optional() })
const searchSchema = z.object({ docs: z.array(documentSchema) })
export type MetadataCandidate = { openLibraryId: string; title: string; authors: string[]; publicationYear: number | null; sourceUrl: string }

// Search returns proposals only: it cannot establish a complete series or its order.
// Never infer an original publication year from an edition's reprint date.
export async function lookupWorkMetadata(title: string, authorName: string) {
  const params = new URLSearchParams({ title, author: authorName, fields: 'key,title,author_name,first_publish_year', limit: '10' })
  try {
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
    if (!response.ok) return { state: 'unavailable' as const, candidates: [] as MetadataCandidate[], message: 'Metadata provider could not respond. Try again later.' }
    const data = searchSchema.safeParse(await response.json())
    if (!data.success) return { state: 'unavailable' as const, candidates: [] as MetadataCandidate[], message: 'Metadata provider returned incomplete or invalid data.' }
    const candidates: MetadataCandidate[] = data.data.docs.flatMap(doc => {
      const id = doc.key.replace(/^\/works\//, '')
      if (!/^OL\d+W$/.test(id)) return []
      return [{ openLibraryId: id, title: doc.title, authors: doc.author_name, publicationYear: doc.first_publish_year ?? null, sourceUrl: `https://openlibrary.org/works/${id}` }]
    })
    const exact = candidates.filter(c => normalizeCollectionIdentity(c.title) === normalizeCollectionIdentity(title) && c.authors.some(a => normalizeCollectionIdentity(a) === normalizeCollectionIdentity(authorName)))
    const uniqueIds = new Set(exact.map(c => c.openLibraryId))
    const state = candidates.length === 0 ? 'missing' : uniqueIds.size === 1 && new Set(exact.map(c => c.publicationYear)).size === 1 ? 'matched' : 'review'
    return { state, candidates, message: state === 'matched' ? 'One title and author match found. Review before applying.' : 'Identity or publication data is incomplete or conflicting; select a match manually.' }
  } catch {
    return { state: 'unavailable' as const, candidates: [] as MetadataCandidate[], message: 'Metadata lookup timed out or failed. Existing metadata is unchanged.' }
  }
}
