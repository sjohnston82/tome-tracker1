import { calculateIsbn13CheckDigit, isValidIsbn13 } from './isbn';

// Historical mass-market UPC -> ISBN prefixes. Only four-digit ISBN prefixes
// are supported: these combine unambiguously with a five-digit title supplement.
// Source: https://www.eblong.com/zarf/bookscan/shelvescripts/upc-map
const PUBLISHERS: Readonly<Record<string, string>> = {
  '018926': '0445', '027778': '0449', '037145': '0812',
  '042799': '0785', '043144': '0688', '044903': '0312',
  '045863': '0517', '046594': '0064', '047132': '0152',
  '051488': '0140', '060771': '0002', '065373': '0373',
  '070992': '0523', '070993': '0446', '070999': '0345',
  '071001': '0380', '071009': '0440', '071136': '0451',
  '071149': '0451', '071152': '0515', '071162': '0451',
  '071831': '0425', '072742': '0441', '076714': '0671',
  '076783': '0553', '076814': '0449', '078021': '0872',
  '079808': '0394', '090129': '0679', '099455': '0061',
  '099769': '0451',
};
export type LegacyBookBarcode = { upc: string; supplement: string; isbn13: string };
function canonicalUpc(raw: string): string | null {
  // Some readers report UPC-A as EAN-13 with one leading padding zero.
  const upc = /^\d{12}$/.test(raw) ? raw : /^0\d{12}$/.test(raw) ? raw.slice(1) : null;
  // ISBN-13 and padded UPC-A use the same EAN checksum calculation.
  return upc && isValidIsbn13(`0${upc}`) ? upc : null;
}
export function supportsLegacyBookBarcode(raw: string): boolean {
  const upc = canonicalUpc(raw);
  return !!upc && !!PUBLISHERS[upc.slice(0, 6)];
}
export function legacyBookBarcode(raw: string, supplement: unknown): LegacyBookBarcode | null {
  const upc = canonicalUpc(raw);
  if (!upc || typeof supplement !== 'string' || !/^\d{5}$/.test(supplement)) return null;
  const prefix = PUBLISHERS[upc.slice(0, 6)];
  if (!prefix) return null;
  // The main UPC's last digits can encode a price; never use them as a title ID.
  const base = `978${prefix}${supplement}`;
  return { upc, supplement, isbn13: base + calculateIsbn13CheckDigit(base) };
}
