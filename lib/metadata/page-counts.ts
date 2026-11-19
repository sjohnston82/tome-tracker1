import { z } from 'zod'
import { sameAuthor } from './covers'
import { authorPeople } from '@/lib/books/author-sort'

export type PageCountOption = { pages: number; title: string; source: 'Open Library' | 'Google Books'; exactIsbn: boolean; isbn?: string; publisher?: string; year?: string }
export type PageCountResult = { suggested: number | null; options: PageCountOption[]; message: string; warnings: string[] }
const strings = z.array(z.string()).optional().default([])
const count = z.number().int().positive().max(1000000)
const editionSchema = z.object({ title: z.string(), number_of_pages: count, isbn_13: strings, isbn_10: strings, publishers: strings, publish_date: z.string().optional() })
const workSchema = z.object({ key: z.string().regex(/^\/works\/OL\d+W$/), title: z.string(), author_name: strings })
const googleSchema = z.object({ volumeInfo: z.object({ title: z.string(), authors: strings, pageCount: count, publisher: z.string().optional(), publishedDate: z.string().optional(), industryIdentifiers: z.array(z.object({ identifier: z.string() })).optional().default([]) }) })
const titleKey = (title: string) => title.normalize('NFKD').toLowerCase().replace(/\bcolour\b/g, 'color').replace(/[^\p{L}\p{N}]/gu, '')
const list = (data: unknown, field: string): unknown[] => typeof data === 'object' && data !== null && Array.isArray((data as Record<string, unknown>)[field]) ? (data as Record<string, unknown>)[field] as unknown[] : []

export async function lookupPageCounts(title: string, author: string, isbn?: string | null, includeAlternatives = false): Promise<PageCountResult> {
  const options: PageCountOption[] = [], warnings: string[] = []
  const authors = authorPeople(author)
  const matches = (candidateTitle: string, credits: string[]) => titleKey(candidateTitle) === titleKey(title) && authors.every(person => credits.some(credit => sameAuthor(person, credit)))
  const fetchJson = async (url: string) => {
    const response = await fetch(url, { signal: AbortSignal.timeout(6000), next: { revalidate: 86400 } })
    if (response.status === 404) return null
    if (!response.ok) throw new Error('Provider unavailable')
    return response.json()
  }
  const google = async (exact: boolean) => {
    try {
      const query = exact ? `isbn:${isbn}` : `intitle:"${title.replace(/"/g, '')}" inauthor:"${(authors[0] ?? author).replace(/"/g, '')}"`
      const params = new URLSearchParams({ q: query, maxResults: '10', printType: 'books' })
      if (process.env.GOOGLE_BOOKS_API_KEY) params.set('key', process.env.GOOGLE_BOOKS_API_KEY)
      const data = await fetchJson(`https://www.googleapis.com/books/v1/volumes?${params}`)
      for (const item of list(data, 'items')) {
        const parsed = googleSchema.safeParse(item)
        if (!parsed.success) continue
        const info = parsed.data.volumeInfo, ids = info.industryIdentifiers.map(id => id.identifier)
        const exactIsbn = !!isbn && ids.includes(isbn)
        if (exact ? !exactIsbn : !matches(info.title, info.authors)) continue
        options.push({ pages: info.pageCount, title: info.title, source: 'Google Books', exactIsbn, isbn: exactIsbn ? isbn! : ids[0], publisher: info.publisher, year: info.publishedDate })
      }
    } catch { warnings.push('Google Books page counts could not be loaded.') }
  }
  const addEdition = (data: unknown, exact: boolean) => {
    const parsed = editionSchema.safeParse(data)
    if (!parsed.success) return
    const edition = parsed.data, ids = [...edition.isbn_13, ...edition.isbn_10]
    const exactIsbn = !!isbn && ids.includes(isbn)
    if ((exact && !exactIsbn) || (!exact && titleKey(edition.title) !== titleKey(title))) return
    options.push({ pages: edition.number_of_pages, title: edition.title, source: 'Open Library', exactIsbn, isbn: exactIsbn ? isbn! : ids[0], publisher: edition.publishers[0], year: edition.publish_date })
  }
  const openLibrary = async (exact: boolean) => {
    try {
      if (exact) { addEdition(await fetchJson(`https://openlibrary.org/isbn/${encodeURIComponent(isbn!)}.json`), true); return }
      const params = new URLSearchParams({ title, author: authors[0] ?? author, limit: '5', fields: 'key,title,author_name' })
      let data = await fetchJson(`https://openlibrary.org/search.json?${params}`)
      if (!list(data, 'docs').length && /\bcolou?r\b/i.test(title)) {
        params.set('title', /\bcolour\b/i.test(title) ? title.replace(/\bcolour\b/ig, 'color') : title.replace(/\bcolor\b/ig, 'colour'))
        await new Promise(resolve => setTimeout(resolve, 1100))
        data = await fetchJson(`https://openlibrary.org/search.json?${params}`)
      }
      const works = list(data, 'docs').flatMap(item => { const parsed = workSchema.safeParse(item); return parsed.success && matches(parsed.data.title, parsed.data.author_name) ? [parsed.data] : [] })
      for (const work of works.slice(0, 2)) {
        await new Promise(resolve => setTimeout(resolve, 1100))
        try { for (const edition of list(await fetchJson(`https://openlibrary.org${work.key}/editions.json?limit=30`), 'entries')) addEdition(edition, false) }
        catch { warnings.push('Some Open Library edition page counts could not be loaded.') }
      }
    } catch { warnings.push('Open Library page counts could not be loaded.') }
  }
  if (isbn) await Promise.all([openLibrary(true), google(true)])
  if (includeAlternatives || !options.some(option => option.exactIsbn)) {
    if (isbn) await new Promise(resolve => setTimeout(resolve, 1100))
    await Promise.all([openLibrary(false), google(false)])
  }
  const distinct = [...new Map(options.map(option => [`${option.pages}:${option.source}:${option.isbn ?? ''}:${option.publisher ?? ''}`, option])).values()]
    .sort((a, b) => Number(b.exactIsbn) - Number(a.exactIsbn) || a.pages - b.pages)
  const exactCounts = new Set(distinct.filter(option => option.exactIsbn).map(option => option.pages))
  const suggested = exactCounts.size === 1 ? [...exactCounts][0] : null
  const message = exactCounts.size > 1 ? 'ISBN sources disagree. Choose the count printed in your physical edition.' : suggested !== null ? 'Page count matched your ISBN. Check it against your edition before saving.' : distinct.length ? 'Edition suggestions only: confirm the page count of the copy you own.' : 'No reliable page count found. You can enter it manually or leave it unknown.'
  return { suggested, options: distinct.slice(0, 12), message, warnings: [...new Set(warnings)] }
}
