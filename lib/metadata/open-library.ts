import { normalizeToIsbn13 } from '@/lib/books/isbn'
import { englishEditionFields, preferredSearchCover, searchEditionsSchema } from './search-edition-covers'
import { BookMetadata, SearchResult, MetadataProvider } from './types'

const BASE_URL = 'https://openlibrary.org'
const COVERS_URL = 'https://covers.openlibrary.org'

export class OpenLibraryProvider implements MetadataProvider {
  name = 'openlibrary'

  async lookupByIsbn(isbn: string): Promise<BookMetadata | null> {
    try {
      const response = await fetch(`${BASE_URL}/isbn/${isbn}.json`, {
        next: { revalidate: 86400 },
      })

      if (!response.ok) return null

      const data = await response.json()
      const authorNames = await this.fetchAuthorNames(data.authors || [])

      return {
        title: data.title,
        authors: authorNames,
        isbn13: isbn.length === 13 ? isbn : undefined,
        isbn10: isbn.length === 10 ? isbn : undefined,
        publisher: data.publishers?.[0],
        publishedYear: this.parseYear(data.publish_date),
        coverUrl: data.covers?.[0]
          ? `${COVERS_URL}/b/id/${data.covers[0]}-L.jpg`
          : undefined,
        description:
          typeof data.description === 'string'
            ? data.description
            : data.description?.value,
        subjects: data.subjects?.slice(0, 10),
        pageCount: data.number_of_pages,
        seriesName: data.series?.[0],
      }
    } catch (error) {
      console.error('Open Library lookup error:', error)
      return null
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({
        q: query,
        limit: '10',
        fields: `title,author_name,isbn,cover_i,first_publish_year,${englishEditionFields}`,
        lang: 'en',
      })

      const response = await fetch(`${BASE_URL}/search.json?${params}`, {
        next: { revalidate: 3600 },
      })

      if (!response.ok) return []

      const data = await response.json()

      return data.docs.map((doc: any) => {
        const parsed = searchEditionsSchema.safeParse(doc.editions);
        const cover = parsed.success ? preferredSearchCover({ cover_i: doc.cover_i, editions: parsed.data }) : null;
        return {
          title: cover?.title ?? doc.title,
          authors: doc.author_name || [],
          isbn13: cover?.isbn.map(normalizeToIsbn13).find((id): id is string => !!id),
          coverUrl: cover ? `${COVERS_URL}/b/id/${cover.coverId}-M.jpg` : undefined,
          publishedYear: doc.first_publish_year,
        };
      })
    } catch (error) {
      console.error('Open Library search error:', error)
      return []
    }
  }

  private async fetchAuthorNames(
    authorRefs: Array<{ key: string }>
  ): Promise<string[]> {
    const names = await Promise.all(
      authorRefs.slice(0, 5).map(async (ref) => {
        try {
          const response = await fetch(`${BASE_URL}${ref.key}.json`)
          if (!response.ok) return null
          const author = await response.json()
          return author.name as string
        } catch {
          return null
        }
      })
    )
    return names.filter((name): name is string => name !== null)
  }

  private parseYear(dateStr?: string): number | undefined {
    if (!dateStr) return undefined
    const match = dateStr.match(/\d{4}/)
    return match ? parseInt(match[0], 10) : undefined
  }
}

export const openLibrary = new OpenLibraryProvider()
