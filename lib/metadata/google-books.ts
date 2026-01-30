import { BookMetadata, SearchResult, MetadataProvider } from './types'

const BASE_URL = 'https://www.googleapis.com/books/v1'

export class GoogleBooksProvider implements MetadataProvider {
  name = 'googlebooks'

  async lookupByIsbn(isbn: string): Promise<BookMetadata | null> {
    try {
      const response = await fetch(`${BASE_URL}/volumes?q=isbn:${isbn}`, {
        next: { revalidate: 86400 },
      })

      if (!response.ok) return null

      const data = await response.json()

      if (!data.items || data.items.length === 0) return null

      const info = data.items[0].volumeInfo

      const isbn13 = info.industryIdentifiers?.find(
        (id: any) => id.type === 'ISBN_13'
      )?.identifier
      const isbn10 = info.industryIdentifiers?.find(
        (id: any) => id.type === 'ISBN_10'
      )?.identifier

      return {
        title: info.title,
        authors: info.authors || [],
        isbn13,
        isbn10,
        publisher: info.publisher,
        publishedYear: this.parseYear(info.publishedDate),
        coverUrl: this.upgradeCoverUrl(info.imageLinks?.thumbnail),
        description: info.description,
        subjects: info.categories?.slice(0, 10),
        pageCount: info.pageCount,
      }
    } catch (error) {
      console.error('Google Books lookup error:', error)
      return null
    }
  }

  async search(query: string): Promise<SearchResult[]> {
    try {
      const params = new URLSearchParams({ q: query, maxResults: '10' })

      const response = await fetch(`${BASE_URL}/volumes?${params}`, {
        next: { revalidate: 3600 },
      })

      if (!response.ok) return []

      const data = await response.json()

      if (!data.items) return []

      return data.items.map((item: any) => {
        const info = item.volumeInfo
        const isbn13 = info.industryIdentifiers?.find(
          (id: any) => id.type === 'ISBN_13'
        )?.identifier

        return {
          title: info.title,
          authors: info.authors || [],
          isbn13,
          coverUrl: this.upgradeCoverUrl(info.imageLinks?.thumbnail),
          publishedYear: this.parseYear(info.publishedDate),
        }
      })
    } catch (error) {
      console.error('Google Books search error:', error)
      return []
    }
  }

  private parseYear(dateStr?: string): number | undefined {
    if (!dateStr) return undefined
    const match = dateStr.match(/\d{4}/)
    return match ? parseInt(match[0], 10) : undefined
  }

  private upgradeCoverUrl(url?: string): string | undefined {
    if (!url) return undefined
    return url.replace('http://', 'https://').replace('zoom=1', 'zoom=2')
  }
}

export const googleBooks = new GoogleBooksProvider()
