import { z } from 'zod'
import { sameAuthor } from './covers'
import { authorPeople } from '@/lib/books/author-sort'
import { coverLanguage, coverLanguageRank } from './cover-language'
import { englishEditionFields, preferredSearchCover, searchEditionsSchema } from './search-edition-covers'

export type CoverOption = { url: string; title: string; authors: string[]; publisher?: string; year?: string; isbn?: string; exactIsbn: boolean; language?: string; source: 'Open Library' | 'Google Books' }
export function isProviderCover(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && ((url.hostname === 'covers.openlibrary.org' && /^\/b\/id\/\d+-[SML]\.jpg$/.test(url.pathname)) || (['books.google.com', 'books.googleusercontent.com'].includes(url.hostname) && url.pathname === '/books/content'))
  } catch { return false }
}
const strings = z.array(z.string()).optional().default([])
const workSchema = z.object({ key: z.string().regex(/^\/works\/OL\d+W$/), title: z.string(), author_name: strings, cover_i: z.number().int().positive().optional(), editions: searchEditionsSchema })
const editionSchema = z.object({ title: z.string(), covers: z.array(z.number().int()).optional().default([]), isbn_13: strings, isbn_10: strings, publishers: strings, publish_date: z.string().optional(), languages: z.array(z.object({ key: z.string() })).optional().default([]) })
const googleSchema = z.object({ volumeInfo: z.object({ title: z.string(), authors: strings, language: z.string().optional(), publisher: z.string().optional(), publishedDate: z.string().optional(), imageLinks: z.object({ thumbnail: z.string().optional(), smallThumbnail: z.string().optional() }).optional(), industryIdentifiers: z.array(z.object({ identifier: z.string() })).optional().default([]) }) })

async function json(url: string) {
  const response = await fetch(url, { signal: AbortSignal.timeout(7000), next: { revalidate: 3600 } })
  if (!response.ok) throw new Error('Provider unavailable')
  return response.json()
}
const records = (value: unknown, field: string): unknown[] => typeof value === 'object' && value !== null && Array.isArray((value as Record<string, unknown>)[field]) ? (value as Record<string, unknown>)[field] as unknown[] : []

export async function searchCoverOptions(title: string, author: string, isbn?: string | null) {
  const warnings: string[] = []
  const options: CoverOption[] = []
  const openLibrary = async () => {
    try {
      const params = new URLSearchParams({ q: title, limit: '20', fields: `key,title,author_name,cover_i,${englishEditionFields}`, lang: 'en' })
      const data = await json(`https://openlibrary.org/search.json?${params}`)
      const works = records(data, 'docs').flatMap(item => { const work = workSchema.safeParse(item); return work.success && (!author.trim() || authorPeople(author).every(person => work.data.author_name.some(name => sameAuthor(person, name)))) ? [work.data] : [] })
      for (const work of works) if (work.cover_i) options.push({ url: `https://covers.openlibrary.org/b/id/${work.cover_i}-L.jpg?default=false`, title: work.title, authors: work.author_name, exactIsbn: false, source: 'Open Library' })
      for (const work of works) {
        const cover = preferredSearchCover(work);
        if (cover) options.push({ url: `https://covers.openlibrary.org/b/id/${cover.coverId}-L.jpg?default=false`, title: cover.title ?? work.title, authors: work.author_name, language: cover.language, isbn: cover.isbn.find(id => id === isbn) ?? cover.isbn[0], exactIsbn: !!isbn && cover.isbn.includes(isbn), source: 'Open Library' });
      }
      // Edition jackets provide alternatives even when Search returns just one work.
      for (const work of works.slice(0, 2)) {
        await new Promise(resolve => setTimeout(resolve, 1100))
        try {
          const data = await json(`https://openlibrary.org${work.key}/editions.json?limit=40`)
          for (const item of records(data, 'entries')) {
            const parsed = editionSchema.safeParse(item)
            if (!parsed.success) continue
            const edition = parsed.data, ids = [...edition.isbn_13, ...edition.isbn_10]
            for (const id of edition.covers.filter(id => id > 0).slice(0, 3)) options.push({ url: `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`, title: edition.title, authors: work.author_name, publisher: edition.publishers[0], year: edition.publish_date, language: coverLanguage(edition.languages.map(ref => ref.key)), isbn: ids.find(id => id === isbn) ?? ids[0], exactIsbn: !!isbn && ids.includes(isbn), source: 'Open Library' })
          }
        } catch { warnings.push('Some Open Library editions could not be loaded.') }
      }
      if (isbn) {
        await new Promise(resolve => setTimeout(resolve, 1100))
        try {
          const edition = editionSchema.safeParse(await json(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`))
          if (edition.success) for (const id of edition.data.covers.filter(id => id > 0)) options.push({ url: `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`, title: edition.data.title, authors: [author], publisher: edition.data.publishers[0], year: edition.data.publish_date, language: coverLanguage(edition.data.languages.map(ref => ref.key)), isbn, exactIsbn: true, source: 'Open Library' })
        } catch { /* An ISBN may have no Open Library edition. */ }
      }
    } catch { warnings.push('Open Library is temporarily unavailable. Try searching again shortly.') }
  }
  const google = async () => {
    try {
      const query = `intitle:"${title.replace(/"/g, '')}"${author ? ` inauthor:"${author.replace(/"/g, '')}"` : ''}`
      const params = new URLSearchParams({ q: query, maxResults: '20', printType: 'books', langRestrict: 'en' })
      if (process.env.GOOGLE_BOOKS_API_KEY) params.set('key', process.env.GOOGLE_BOOKS_API_KEY)
      const data = await json(`https://www.googleapis.com/books/v1/volumes?${params}`)
      for (const item of records(data, 'items')) {
        const parsed = googleSchema.safeParse(item)
        if (!parsed.success) continue
        const info = parsed.data.volumeInfo, image = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail
        if (!image) continue
        const url = image.replace(/^http:/, 'https:')
        if (!isProviderCover(url)) continue
        const ids = info.industryIdentifiers.map(id => id.identifier)
        options.push({ url, title: info.title, authors: info.authors, publisher: info.publisher, year: info.publishedDate, language: coverLanguage(info.language ? [info.language] : []), isbn: ids.find(id => id === isbn) ?? ids[0], exactIsbn: !!isbn && ids.includes(isbn), source: 'Google Books' })
      }
    } catch { warnings.push('Google Books is temporarily unavailable. Other results are still available.') }
  }
  await Promise.all([openLibrary(), google()])
  const unique = new Map<string, CoverOption>()
  for (const option of options) {
    const existing = unique.get(option.url)
    unique.set(option.url, { ...existing, ...option, language: option.language ?? existing?.language, publisher: option.publisher ?? existing?.publisher, year: option.year ?? existing?.year, isbn: option.isbn ?? existing?.isbn, exactIsbn: existing?.exactIsbn || option.exactIsbn })
  }
  return { options: [...unique.values()].sort((a, b) => Number(b.exactIsbn) - Number(a.exactIsbn) || coverLanguageRank(a.language) - coverLanguageRank(b.language)).slice(0, 60), warnings }
}
