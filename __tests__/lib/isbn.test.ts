import { describe, it, expect } from 'vitest'
import {
  normalizeToIsbn13,
  isbn10ToIsbn13,
  isValidIsbn13,
  extractIsbnFromBarcode,
} from '@/lib/books/isbn'

describe('ISBN utilities', () => {
  describe('normalizeToIsbn13', () => {
    it('returns valid ISBN-13 as-is', () => {
      expect(normalizeToIsbn13('9780765311788')).toBe('9780765311788')
    })

    it('converts ISBN-10 to ISBN-13', () => {
      expect(normalizeToIsbn13('0765311785')).toBe('9780765311788')
      expect(isbn10ToIsbn13('0765311785')).toBe('9780765311788')
    })

    it('handles ISBN with dashes', () => {
      expect(normalizeToIsbn13('978-0-7653-1178-8')).toBe('9780765311788')
    })

    it('returns null for invalid ISBN', () => {
      expect(normalizeToIsbn13('invalid')).toBeNull()
    })
  })

  describe('isValidIsbn13', () => {
    it('validates correct ISBN-13', () => {
      expect(isValidIsbn13('9780765311788')).toBe(true)
    })

    it('rejects invalid check digit', () => {
      expect(isValidIsbn13('9780765311789')).toBe(false)
    })
  })

  describe('extractIsbnFromBarcode', () => {
    it('extracts ISBN from barcode string', () => {
      expect(extractIsbnFromBarcode('EAN 9780765311788')).toBe('9780765311788')
    })

    it('returns null when no ISBN found', () => {
      expect(extractIsbnFromBarcode('not-a-barcode')).toBeNull()
    })
  })
})
