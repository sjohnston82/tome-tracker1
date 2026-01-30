export function normalizeToIsbn13(isbn: string): string | null {
  const cleaned = isbn.replace(/[-\s]/g, '')

  if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) {
    return cleaned
  }

  if (cleaned.length === 10 && /^\d{9}[\dX]$/i.test(cleaned)) {
    return isbn10ToIsbn13(cleaned)
  }

  return null
}

export function isbn10ToIsbn13(isbn10: string): string {
  const base = `978${isbn10.slice(0, 9)}`
  const checkDigit = calculateIsbn13CheckDigit(base)
  return base + checkDigit
}

export function calculateIsbn13CheckDigit(first12: string): string {
  let sum = 0
  for (let i = 0; i < 12; i += 1) {
    const digit = parseInt(first12[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  const check = (10 - (sum % 10)) % 10
  return check.toString()
}

export function isValidIsbn13(isbn: string): boolean {
  if (!/^\d{13}$/.test(isbn)) return false

  let sum = 0
  for (let i = 0; i < 13; i += 1) {
    const digit = parseInt(isbn[i], 10)
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return sum % 10 === 0
}

export function extractIsbnFromBarcode(barcode: string): string | null {
  const normalized = normalizeToIsbn13(barcode)
  if (normalized && isValidIsbn13(normalized)) {
    return normalized
  }

  const patterns = [/978\d{10}/, /979\d{10}/, /\d{9}[\dX]/i]

  for (const pattern of patterns) {
    const match = barcode.match(pattern)
    if (match) {
      const result = normalizeToIsbn13(match[0])
      if (result && isValidIsbn13(result)) {
        return result
      }
    }
  }

  return null
}
