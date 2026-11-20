import { z } from 'zod'
import { normalizeToIsbn13 } from '@/lib/books/isbn'
import { authorPeople } from '@/lib/books/author-sort'
import { englishEditionFields, searchEditionsSchema, preferredSearchCover } from './search-edition-covers'
import { coverLanguageRank } from './cover-language'

const normalize = (value: string) => value.normalize('NFKD').toLowerCase().replace(/\bcolour\b/g, 'color').replace(/[^\p{L}\p{N}]/gu, '')
const responseSchema = z.object({ docs: z.array(z.unknown()) })
const documentSchema = z.object({ title: z.string(), author_name: z.array(z.string()).optional(), isbn: z.array(z.string()).optional(), cover_i: z.number().int().positive().optional(), editions: searchEditionsSchema })

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
    if (isbn) {
      // ISBN search results are works and their generic jacket may be in any
      // language. Resolve the physical edition directly instead.
      const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, { signal: AbortSignal.timeout(4500), next: { revalidate: 86400 } });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Cover provider returned HTTP ${response.status}`);
      const edition = z.object({ covers: z.array(z.number().int()).optional().default([]), isbn_13: z.array(z.string()).optional().default([]), isbn_10: z.array(z.string()).optional().default([]) }).safeParse(await response.json());
      if (!edition.success) return null;
      const requested = normalizeToIsbn13(isbn);
      if (![...edition.data.isbn_13, ...edition.data.isbn_10].some(id => id === isbn || (requested !== null && normalizeToIsbn13(id) === requested))) return null;
      const cover = edition.data.covers.find(id => id > 0);
      return cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false` : null;
    }
    const params = new URLSearchParams({ limit: '20', lang: 'en', fields: `title,author_name,isbn,cover_i,${englishEditionFields}`, q: title });
    const search = async () => {
      const response = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: AbortSignal.timeout(4500), next: { revalidate: 86400 } })
      if (!response.ok) throw new Error(`Cover provider returned HTTP ${response.status}`)
      const parsed = responseSchema.safeParse(await response.json())
      if (!parsed.success) throw new Error('Invalid cover provider response')
      return parsed.data
    }
    let result = await search()
    if (!isbn && !result.docs.length && /\bcolou?r\b/i.test(title)) {
      params.set('q', /\bcolour\b/i.test(title) ? title.replace(/\bcolour\b/ig, 'color') : title.replace(/\bcolor\b/ig, 'colour'))
      await new Promise(resolve => setTimeout(resolve, 1100))
      result = await search()
    }
    const authors = authorPeople(author);
    const docs = result.docs.flatMap(value => { const doc = documentSchema.safeParse(value); return doc.success ? [doc.data] : [] });
    const matches = docs.flatMap(doc => {
      const cover = preferredSearchCover(doc);
      if (!cover || (normalize(doc.title) !== normalize(title) && normalize(cover.title ?? '') !== normalize(title)) || !authors.every(name => doc.author_name?.some(a => sameAuthor(a, name)))) return [];
      return [cover];
    }).sort((a, b) => coverLanguageRank(a.language) - coverLanguageRank(b.language));
    const cover = matches[0]?.coverId;
    return cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false` : null;
  } catch (error) { if (reportFailure) throw error; return null }
}
