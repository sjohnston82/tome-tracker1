export function normalizeToIsbn13(isbn: string): string | null {
  const cleaned = isbn.replace(/[-\s]/g, '')

  if (cleaned.length === 13 && /^\d{13}$/.test(cleaned)) {
    return cleaned
  }

  if (
    cleaned.length === 10 &&
    /^\d{9}[\dX]$/i.test(cleaned) &&
    isValidIsbn10(cleaned)
  ) {
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

export function isValidIsbn10(isbn: string): boolean {
  if (!/^\d{9}[\dX]$/i.test(isbn)) return false

  let sum = 0
  for (let i = 0; i < 10; i += 1) {
    const char = isbn[i].toUpperCase()
    const value = char === 'X' ? 10 : parseInt(char, 10)
    sum += value * (10 - i)
  }
  return sum % 11 === 0
}

export function extractIsbnFromBarcode(barcode: string): string | null {
  const verified = (value: string) => {
    const normalized = normalizeToIsbn13(value);
    return normalized && /^(978|979)/.test(normalized) && isValidIsbn13(normalized) ? normalized : null;
  };
  const normalized = verified(barcode.trim());
  if (normalized) return normalized;

  // Never manufacture an ISBN from ten digits embedded in a UPC/EAN or other
  // longer numeric identifier. A coincidental ISBN-10 checksum is not evidence.
  const patterns = [/(?<![\dX])(?:978|979)\d{10}(?![\dX])/gi, /(?<![\dX])\d{9}[\dX](?![\dX])/gi];
  for (const pattern of patterns) {
    for (const match of barcode.matchAll(pattern)) {
      const result = verified(match[0]);
      if (result) return result;
    }
  }
  return null;
}
