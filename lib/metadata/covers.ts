import { z } from 'zod'

const normalize = (value: string) => value.normalize('NFKD').toLowerCase().replace(/\bcolour\b/g, 'color').replace(/[^\p{L}\p{N}]/gu, '')
const responseSchema = z.object({ docs: z.array(z.unknown()) })
const documentSchema = z.object({ title: z.string(), author_name: z.array(z.string()).optional(), isbn: z.array(z.string()).optional(), cover_i: z.number().int().positive() })

export function sameAuthor(a: string, b: string): boolean {
  const words = (name: string) => {
    const reordered = name.includes(',') ? name.split(',').reverse().join(' ') : name
    return reordered.normalize('NFKD').toLowerCase().replace(/[.\u0300-\u036f]/g, '').trim().split(/\s+/)
  }
  const left = words(a), right = words(b)
  if (left.at(-1) !== right.at(-1)) return false
  const initialsMatch = (x: string, y: string) => x === y || ((x.length === 1 || y.length === 1) && x[0] === y[0])
  if (!initialsMatch(left[0], right[0])) return false
  const lm = left.slice(1, -1), rm = right.slice(1, -1)
  return !lm.length || !rm.length || (lm.length === rm.length && lm.every((v, i) => initialsMatch(v, rm[i])))
}

// A title search identifies a work, not necessarily the user's exact cover edition.
export async function findBookCover(title: string, author: string, isbn?: string | null, reportFailure = false): Promise<string | null> {
  try {
    const params = new URLSearchParams({ limit: '10', fields: 'title,author_name,isbn,cover_i' })
    if (isbn) params.set('q', `isbn:${isbn}`)
    else { params.set('title', title); params.set('author', author) }
    const search = async () => {
      const response = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: AbortSignal.timeout(4500), next: { revalidate: 86400 } })
      if (!response.ok) throw new Error(`Cover provider returned HTTP ${response.status}`)
      const parsed = responseSchema.safeParse(await response.json())
      if (!parsed.success) throw new Error('Invalid cover provider response')
      return parsed.data
    }
    let result = await search()
    if (!isbn && !result.docs.length && /\bcolou?r\b/i.test(title)) {
      params.set('title', /\bcolour\b/i.test(title) ? title.replace(/\bcolour\b/ig, 'color') : title.replace(/\bcolor\b/ig, 'colour'))
      await new Promise(resolve => setTimeout(resolve, 1100))
      result = await search()
    }
    const authors = author.split(/\s+(?:and|&)\s+|\s*\/\s*|;/i)
    const docs = result.docs.flatMap(value => { const doc = documentSchema.safeParse(value); return doc.success ? [doc.data] : [] })
    const matches = docs.filter(doc => isbn ? doc.isbn?.includes(isbn) : normalize(doc.title) === normalize(title) && authors.every(name => doc.author_name?.some(a => sameAuthor(a, name))))
    // More than one edition of the same title/author is fine for representative artwork.
    const cover = matches[0]?.cover_i
    return cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false` : null
  } catch (error) { if (reportFailure) throw error; return null }
}
