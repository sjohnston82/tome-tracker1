import { z } from 'zod'
import { normalizeToIsbn13 } from '@/lib/books/isbn'
import { authorPeople } from '@/lib/books/author-sort'
import { englishEditionFields, searchEditionsSchema, preferredSearchCover } from './search-edition-covers'
import { coverLanguage, coverLanguageRank } from './cover-language'
import { coverTitleMatches, coverSearchTitle, isSplitCoverTitle } from './cover-title'

const searchTitle = (title: string) => title.replace(/^(?:the|a|an)\s+/i, '').trim()
const responseSchema = z.object({ docs: z.array(z.unknown()) })
const documentSchema = z.object({ key: z.string().regex(/^\/works\/OL\d+W$/).optional(), title: z.string(), author_name: z.array(z.string()).optional(), isbn: z.array(z.string()).optional(), cover_i: z.number().int().positive().optional(), editions: searchEditionsSchema })

export function sameAuthor(a: string, b: string): boolean {
  const words = (name: string) => {
    const clean = name.trim().replace(/,?\s+(?:jr\.?|sr\.?|ii|iii|iv)$/i, '')
    const reordered = clean.includes(',') ? clean.split(',').reverse().join(' ') : clean
    return reordered.normalize('NFKD').toLowerCase().replace(/[.\u0300-\u036f]/g, '').trim().split(/\s+/)
  }
  const left = words(a), right = words(b)
  if (left.at(-1) !== right.at(-1)) return false
  const initialsMatch = (x: string, y: string) => x === y || ((x.length === 1 || y.length === 1) && x[0] === y[0])
  if (!initialsMatch(left[0], right[0])) return false
  const lm = left.slice(1, -1), rm = right.slice(1, -1)
  return !lm.length || !rm.length || (lm.length === rm.length && lm.every((v, i) => initialsMatch(v, rm[i])))
}

// A title search identifies a work, not necessarily the user's exact cover edition.
const providerSignal = (deadline: number, limit: number) => AbortSignal.timeout(Math.max(1, Math.min(limit, deadline - Date.now())))

async function openLibraryCover(title: string, author: string, isbn: string | null | undefined, deadline: number): Promise<string | null> {
  try {
    if (isbn) {
      // ISBN search results are works and their generic jacket may be in any
      // language. Resolve the physical edition directly instead.
      const response = await fetch(`https://openlibrary.org/isbn/${encodeURIComponent(isbn)}.json`, { signal: providerSignal(deadline, 10000), next: { revalidate: 86400 } });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Cover provider returned HTTP ${response.status}`);
      const edition = z.object({ covers: z.array(z.number().int()).optional().default([]), isbn_13: z.array(z.string()).optional().default([]), isbn_10: z.array(z.string()).optional().default([]) }).safeParse(await response.json());
      if (!edition.success) return null;
      const requested = normalizeToIsbn13(isbn);
      if (![...edition.data.isbn_13, ...edition.data.isbn_10].some(id => id === isbn || (requested !== null && normalizeToIsbn13(id) === requested))) return null;
      const cover = edition.data.covers.find(id => id > 0);
      return cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false` : null;
    }
    const params = new URLSearchParams({ limit: '5', lang: 'en', fields: `key,title,author_name,isbn,cover_i,${englishEditionFields}`, q: searchTitle(title) });
    const search = async () => {
      const response = await fetch(`https://openlibrary.org/search.json?${params}`, { signal: providerSignal(deadline, 10000), next: { revalidate: 86400 } })
      if (!response.ok) throw new Error(`Cover provider returned HTTP ${response.status}`)
      const parsed = responseSchema.safeParse(await response.json())
      if (!parsed.success) throw new Error('Invalid cover provider response')
      return parsed.data
    }
    let result = await search()
    if (!isbn && !result.docs.length && /\bcolou?r\b/i.test(title)) {
      params.set('q', /\bcolour\b/i.test(title) ? searchTitle(title).replace(/\bcolour\b/ig, 'color') : searchTitle(title).replace(/\bcolor\b/ig, 'colour'))
      await new Promise(resolve => setTimeout(resolve, 1100))
      result = await search()
    }
    const authors = authorPeople(author);
    const docs = result.docs.flatMap(value => { const doc = documentSchema.safeParse(value); return doc.success ? [doc.data] : [] });
    const matches = docs.filter(doc => authors.every(name => doc.author_name?.some(a => sameAuthor(a, name))) && (
      coverTitleMatches(title, doc.title) || preferredSearchCover(doc, title)?.title !== undefined
      || (isSplitCoverTitle(title) && coverTitleMatches(coverSearchTitle(title), doc.title))
    ));
    const candidates = matches.flatMap(doc => {
      const cover = preferredSearchCover(doc, title);
      // A generic work jacket must describe the full requested physical title.
      return cover && (cover.title || coverTitleMatches(title, doc.title)) ? [cover] : [];
    }).sort((a, b) => coverLanguageRank(a.language) - coverLanguageRank(b.language));
    const english = candidates.find(cover => cover.language === 'en');
    if (english) return `https://covers.openlibrary.org/b/id/${english.coverId}-L.jpg?default=false`;
    // Search can omit edition data or select an English edition without a jacket.
    // Check the matched work's actual editions before giving up or using unknown artwork.
    const work = matches.find(doc => doc.key);
    if (work?.key) {
      const response = await fetch(`https://openlibrary.org${work.key}/editions.json?limit=100`, { signal: providerSignal(deadline, 8000), next: { revalidate: 86400 } });
      if (!response.ok) throw new Error(`Cover provider returned HTTP ${response.status}`);
      const data = await response.json();
      const schema = z.object({ title: z.string().optional(), subtitle: z.string().optional(), covers: z.array(z.number().int()).optional().default([]), languages: z.array(z.object({ key: z.string() })).optional().default([]) });
      for (const item of Array.isArray(data.entries) ? data.entries : []) {
        const edition = schema.safeParse(item);
        if (!edition.success || (edition.data.title ? !coverTitleMatches(title, edition.data.title, edition.data.subtitle) : isSplitCoverTitle(title)) || coverLanguage(edition.data.languages.map(language => language.key)) !== 'en') continue;
        const id = edition.data.covers.find(id => id > 0);
        if (id) return `https://covers.openlibrary.org/b/id/${id}-L.jpg?default=false`;
      }
    }
    const cover = candidates[0]?.coverId;
    return cover ? `https://covers.openlibrary.org/b/id/${cover}-L.jpg?default=false` : null;
  } catch (error) { throw error; }
}

const googleVolumeSchema = z.object({ volumeInfo: z.object({ title: z.string(), subtitle: z.string().optional(), authors: z.array(z.string()).optional().default([]), language: z.string().optional(), industryIdentifiers: z.array(z.object({ identifier: z.string() })).optional().default([]), imageLinks: z.object({ thumbnail: z.string().optional(), smallThumbnail: z.string().optional() }).optional() }) });
async function googleCover(title: string, author: string, isbn: string | null | undefined, deadline: number) {
  const queryAuthor = (authorPeople(author)[0] ?? author).trim().replace(/,?\s+(?:jr\.?|sr\.?|ii|iii|iv)$/i, '');
  const params = new URLSearchParams({ q: isbn ? `isbn:${isbn}` : `intitle:"${coverSearchTitle(title).replace(/"/g, '')}" inauthor:"${queryAuthor.replace(/"/g, '')}"`, maxResults: '10', printType: 'books', key: process.env.GOOGLE_BOOKS_API_KEY! });
  if (!isbn) params.set('langRestrict', 'en');
  const response = await fetch(`https://www.googleapis.com/books/v1/volumes?${params}`, { signal: providerSignal(deadline, 7000), next: { revalidate: 86400 } });
  if (!response.ok) throw new Error(`Google Books cover lookup returned HTTP ${response.status}`);
  const data = await response.json(), authors = authorPeople(author), candidates: { url: string; language?: string }[] = [];
  for (const item of Array.isArray(data.items) ? data.items : []) {
    const parsed = googleVolumeSchema.safeParse(item); if (!parsed.success) continue;
    const info = parsed.data.volumeInfo, language = coverLanguage(info.language ? [info.language] : []);
    if (isbn ? !info.industryIdentifiers.some(id => id.identifier === isbn || (normalizeToIsbn13(isbn) !== null && normalizeToIsbn13(id.identifier) === normalizeToIsbn13(isbn))) : !coverTitleMatches(title, info.title, info.subtitle) || !authors.every(person => info.authors.some(credit => sameAuthor(person, credit))) || coverLanguageRank(language) === 2) continue;
    const image = info.imageLinks?.thumbnail ?? info.imageLinks?.smallThumbnail; if (!image) continue;
    try {
      const url = new URL(image.replace(/^http:/, 'https:'));
      if (url.protocol !== 'https:' || url.username || url.password || url.port || !['books.google.com', 'books.googleusercontent.com'].includes(url.hostname) || url.pathname !== '/books/content') continue;
      candidates.push({ url: url.toString(), language });
    } catch { /* Ignore invalid provider image URLs. */ }
  }
  return candidates.sort((a, b) => coverLanguageRank(a.language) - coverLanguageRank(b.language))[0] ?? null;
}

export async function findBookCover(title: string, author: string, isbn?: string | null, reportFailure = false): Promise<string | null> {
  const deadline = Date.now() + 25000;
  const keyedGoogle = !!process.env.GOOGLE_BOOKS_API_KEY?.trim();
  let failure: unknown, googleUnknown: { url: string; language?: string } | null = null;
  // With a configured key, Google's English volume lookup avoids waiting for
  // slower work/edition expansion on every imported book. Exact ISBNs keep priority.
  if (keyedGoogle && !isbn) {
    try { googleUnknown = await googleCover(title, author, undefined, deadline); if (googleUnknown?.language === 'en') return googleUnknown.url; }
    catch (error) { failure = error; }
  }
  try { const cover = await openLibraryCover(title, author, isbn, deadline); if (cover) return cover; }
  catch (error) { failure = error; }
  if (keyedGoogle && isbn) {
    try { const cover = await googleCover(title, author, isbn, deadline); if (cover) return cover.url; }
    catch (error) { failure = error; }
  }
  if (googleUnknown) return googleUnknown.url;
  if (reportFailure && failure) throw failure;
  return null;
}
