import { describe, it, expect } from 'vitest'
import { openLibrary } from '@/lib/metadata/open-library'

describe('OpenLibrary Provider', () => {
  it('finds book by ISBN-13', async () => {
    const result = await openLibrary.lookupByIsbn('9780765326355')

    expect(result).not.toBeNull()
    expect(result!.title).toContain('Way of Kings')
    expect(Array.isArray(result!.authors)).toBe(true)
  }, 15000)

  it('returns null for non-existent ISBN', async () => {
    const result = await openLibrary.lookupByIsbn('not-an-isbn')
    expect(result).toBeNull()
  }, 15000)

  it('searches for books', async () => {
    const results = await openLibrary.search('mistborn sanderson')

    expect(results.length).toBeGreaterThan(0)
    const hasMatch = results.some(
      (result) =>
        result.title.toLowerCase().includes('mistborn') ||
        result.authors.some((author) => author.toLowerCase().includes('sanderson'))
    )
    expect(hasMatch).toBe(true)
  }, 15000)
})
