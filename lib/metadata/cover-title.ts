// Normalize edition numbering only after explicit physical part/volume markers.
const marker = /\b(part|pt\.?|volume|vol\.?)\s+([ivxlcdm]+|\d+)\b/gi;
function romanNumber(value: string): string {
  if (/^\d+$/.test(value)) return String(Number(value));
  const roman = value.toUpperCase();
  if (!/^(?=.)M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/.test(roman)) return value;
  const digits: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  return String([...roman].reduce((sum, digit, i) => sum + (digits[digit] < (digits[roman[i + 1]] ?? 0) ? -digits[digit] : digits[digit]), 0));
}
export function normalizeCoverTitle(value: string): string {
  return value.normalize('NFKD').toLowerCase().replace(/\bcolour\b/g, 'color')
    .replace(/^(?:the|a|an)\s+/, '')
    .replace(marker, (_match, kind: string, number: string) => `${/^p/i.test(kind) ? 'part' : 'volume'} ${romanNumber(number)}`)
    .replace(/[^\p{L}\p{N}]/gu, '');
}
export function coverTitleMatches(expected: string, title: string, subtitle?: string): boolean {
  return normalizeCoverTitle(expected) === normalizeCoverTitle(title)
    || (!!subtitle && normalizeCoverTitle(expected) === normalizeCoverTitle(`${title}: ${subtitle}`));
}
// Broaden retrieval for split editions, then require the complete title locally.
export function coverSearchTitle(title: string): string {
  const match = /[, :–—-]*\b(?:part|pt\.?|volume|vol\.?)\s+(?:[ivxlcdm]+|\d+)\b/i.exec(title);
  return (match ? title.slice(0, match.index) : title).replace(/^(?:the|a|an)\s+/i, '').trim();
}
export function isSplitCoverTitle(title: string): boolean {
  return coverSearchTitle(title) !== title.replace(/^(?:the|a|an)\s+/i, '').trim();
}
