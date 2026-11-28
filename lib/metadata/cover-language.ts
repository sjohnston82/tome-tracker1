const aliases: Record<string, string> = { eng: 'en', ger: 'de', deu: 'de', fre: 'fr', fra: 'fr', spa: 'es', ita: 'it', por: 'pt', dut: 'nl', nld: 'nl' };
export function coverLanguage(codes: string[] = []): string | undefined {
  const languages = codes.map(code => code.split('/').at(-1)!.toLowerCase()).map(code => aliases[code] ?? code).filter(code => /^[a-z]{2,3}(?:-[a-z0-9]+)*$/.test(code) && !['und', 'mul', 'un'].includes(code));
  return languages.find(code => code === 'en' || code.startsWith('en-')) ? 'en' : languages[0];
}
// English, then unknown, then explicitly non-English. Exact ISBN ranking is separate.
export const coverLanguageRank = (language?: string) => { const known = coverLanguage(language ? [language] : []); return known ? known === 'en' ? 0 : 2 : 1; };
export function coverLanguageLabel(language?: string): string {
  if (!language) return 'Language unknown';
  try { return new Intl.DisplayNames(['en'], { type: 'language' }).of(language) ?? language; } catch { return language; }
}
