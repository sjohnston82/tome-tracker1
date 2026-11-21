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
      expect(normalizeToIsbn13('076531178X')).toBe('9780765311788')
      expect(isbn10ToIsbn13('076531178X')).toBe('9780765311788')
    })

    it('handles ISBN with dashes', () => {
      expect(normalizeToIsbn13('978-0-7653-1178-8')).toBe('9780765311788')
    })

    it('returns null for invalid ISBN', () => {
      expect(normalizeToIsbn13('invalid')).toBeNull()
    })

    it('returns null for invalid ISBN-10 check digit', () => {
      expect(normalizeToIsbn13('0765311786')).toBeNull()
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
  it.each([
    ['0-553-57990-8', '9780553579901'],
    ['0-670-03003-1', '9780670030033'],
    ['0-451-18784-9', '9780451187840'],
  ])('normalizes the printed ISBN %s without guessing an edition', (raw, expected) => {
    expect(extractIsbnFromBarcode(raw)).toBe(expected);
  });
  it('never slices an ISBN-10 out of a longer retail code or accepts a non-Bookland EAN', () => {
    expect(extractIsbnFromBarcode('030640615200')).toBeNull();
    expect(extractIsbnFromBarcode('0030640615200')).toBeNull();
    expect(extractIsbnFromBarcode('4006381333931')).toBeNull();
    expect(extractIsbnFromBarcode('123978055357990100')).toBeNull();
    expect(extractIsbnFromBarcode('EAN 9780553579901')).toBe('9780553579901');
  });

})
