import { authorPeople } from './author-sort';
import { extractIsbnFromBarcode } from './isbn';
import { similarity } from './fuzzy-match';
import { sameAuthor } from '@/lib/metadata/covers';
import { isSplitCoverTitle, normalizeCoverTitle } from '@/lib/metadata/cover-title';

export type ScanMatchInput = { isbn?: string | null; title?: string; authors?: string[] };
export type ScanMatch = {
  id: string; title: string; author: string; isbn13: string | null; isbn10: string | null;
  publicationYear: number | null; coverUrl: string | null; readingStatus: string;
  updatedAt: string; kind: 'isbn' | 'title-author' | 'possible'; reason: string; canLink: boolean;
};
export type ScanMatches = { matches: ScanMatch[]; totalMatches: number; exactCount: number };
export type MatchableBook = Omit<ScanMatch, 'author' | 'kind' | 'reason' | 'canLink'> & { author: { name: string } };
const sameCredit = (left: string, right: string) => sameAuthor(left.replace(/\b([A-Za-z])\.(?=[A-Za-z])/g, '$1. '), right.replace(/\b([A-Za-z])\.(?=[A-Za-z])/g, '$1. '));
const collectionEdition = (title: string) => /\b(?:omnibus|trilogy|collection|collected|complete|boxed|box set|anthology)\b/i.test(title);
export function matchScannedBooks(input: ScanMatchInput, books: MatchableBook[]): ScanMatches {
  const isbn = input.isbn ? extractIsbnFromBarcode(input.isbn) : null;
  const expectedAuthors = (input.authors ?? []).flatMap(authorPeople).filter(value => !!value && !/^unknown(?: author)?$/i.test(value.trim()));
  const title = input.title ? normalizeCoverTitle(input.title) : '';
  const ranked = books.flatMap(book => {
    const exactIsbn = !!isbn && [book.isbn13, book.isbn10].some(value => value && extractIsbnFromBarcode(value) === isbn);
    const actualTitle = normalizeCoverTitle(book.title);
    const sameTitle = !!title && title === actualTitle;
    const credits = authorPeople(book.author.name);
    const anyAuthor = expectedAuthors.some(person => credits.some(credit => sameCredit(person, credit)));
    const allAuthors = expectedAuthors.length > 0 && expectedAuthors.every(person => credits.some(credit => sameCredit(person, credit))) && credits.every(credit => expectedAuthors.some(person => sameCredit(person, credit)));
    // Similar spelling must not conflate physical parts or omnibus/single editions.
    const safeFuzzy = input.title && !isSplitCoverTitle(input.title) && !isSplitCoverTitle(book.title) && collectionEdition(input.title) === collectionEdition(book.title) && (input.title.match(/\d+/g) ?? []).join(',') === (book.title.match(/\d+/g) ?? []).join(',') && !/\bbook\s+(?:[ivxlcdm]+|\d+)\b/i.test(`${input.title} ${book.title}`);
    const titleScore = title ? similarity(title, actualTitle) : 0;
    if (!exactIsbn && !((sameTitle && (anyAuthor || !expectedAuthors.length)) || (safeFuzzy && allAuthors && titleScore >= 0.9))) return [];
    const kind: ScanMatch['kind'] = exactIsbn ? 'isbn' : sameTitle && allAuthors ? 'title-author' : 'possible';
    const reason = kind === 'isbn' ? 'ISBN already recorded' : kind === 'title-author' ? 'Title and author match' : sameTitle ? 'Title matches; check author credits' : 'Similar title and matching author; review carefully';
    const canLink = !!isbn && !book.isbn13 && (!book.isbn10 || extractIsbnFromBarcode(book.isbn10) === isbn);
    const candidate: ScanMatch = { ...book, author: book.author.name, kind, reason, canLink };
    return [{ candidate, rank: exactIsbn ? 3 : kind === 'title-author' ? 2 : 1, titleScore }];
  }).sort((a, b) => b.rank - a.rank || b.titleScore - a.titleScore || Number(b.candidate.canLink) - Number(a.candidate.canLink) || a.candidate.id.localeCompare(b.candidate.id));
  return { matches: ranked.slice(0, 10).map(item => item.candidate), totalMatches: ranked.length, exactCount: ranked.filter(item => item.candidate.kind === 'isbn').length };
}
