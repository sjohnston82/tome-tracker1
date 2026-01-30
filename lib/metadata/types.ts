export interface BookMetadata {
  title: string
  authors: string[]
  isbn13?: string
  isbn10?: string
  publisher?: string
  publishedYear?: number
  coverUrl?: string
  description?: string
  subjects?: string[]
  seriesName?: string
  seriesNumber?: number
  pageCount?: number
}

export interface SearchResult {
  title: string
  authors: string[]
  isbn13?: string
  coverUrl?: string
  publishedYear?: number
}

export interface MetadataProvider {
  name: string
  lookupByIsbn(isbn: string): Promise<BookMetadata | null>
  search(query: string): Promise<SearchResult[]>
}
