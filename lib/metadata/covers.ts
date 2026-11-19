import { z } from 'zod'

const normalize = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
const responseSchema = z.object({ docs: z.array(z.object({ title: z.string(), author_name: z.array(z.string()).optional(), isbn: z.array(z.string()).optional(), cover_i: z.number().int().positive().optional() })) })

// A title search identifies a work, not necessarily the user's exact cover edition.
export async function findBookCover(title: string, author: string, isbn?: string | null): Promise<string | null> {
  try {
    const params = new URLSearchParams({ limit: '10', fields: 'title,author_name,isbn,cover_i' })
    if (isbn) params.set('q', `isbn:${isbn}`)
    else { params.set('title', title); params.set('author', author) }
    const response = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } })
    if (!response.ok) return null
    const parsed = responseSchema.safeParse(await response.json())
    if (!parsed.success) return null
    const authors = author.split(/\s+(?:and|&)\s+|\s*\/\s*|;/i).map(normalize)
    const matches = parsed.data.docs.filter(doc => doc.cover_i && (isbn ? doc.isbn?.includes(isbn) : normalize(doc.title) === normalize(title) && authors.every(name => doc.author_name?.some(a => normalize(a) === name))))
    // Multiple different title matches are left unresolved instead of guessing.
    const covers = [...new Set(matches.map(doc => doc.cover_i))]
    return covers.length === 1 ? `https://covers.openlibrary.org/b/id/${covers[0]}-L.jpg?default=false` : null
  } catch { return null }
}
