import { BookMetadata, SearchResult } from './types'
import { openLibrary } from './open-library'
import { googleBooks } from './google-books'

export async function lookupByIsbn(isbn: string): Promise<BookMetadata | null> {
  let result = await openLibrary.lookupByIsbn(isbn)

  if (result) return result

  result = await googleBooks.lookupByIsbn(isbn)

  return result
}

export async function searchBooks(query: string): Promise<SearchResult[]> {
  let results = await openLibrary.search(query)

  if (results.length > 0) return results

  results = await googleBooks.search(query)

  return results
}

export { type BookMetadata, type SearchResult } from './types'
