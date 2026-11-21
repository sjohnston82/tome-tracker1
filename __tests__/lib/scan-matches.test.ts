import { describe, expect, it } from 'vitest';
import { matchScannedBooks, type MatchableBook } from '@/lib/books/scan-matches';
const book = (id: string, changes: Partial<MatchableBook> = {}): MatchableBook => ({ id, title: 'A Clash of Kings', author: { name: 'George R. R. Martin' }, isbn13: null, isbn10: null, publicationYear: 1998, coverUrl: null, readingStatus: 'UNREAD', updatedAt: '2026-11-21T12:00:00.000Z', ...changes });
describe('scan suggestions distinguish works and physical editions', () => {
  it('ranks recorded ISBNs first even if the external catalog supplies the wrong title', () => {
    const result = matchScannedBooks({ isbn: '0-451-18784-9', title: 'Wrong catalog title', authors: ['Wrong author'] }, [book('other'), book('own', { title: 'We the Living', isbn10: '0-451-18784-9' })]);
    expect(result.exactCount).toBe(1); expect(result.matches[0]).toMatchObject({ id: 'own', kind: 'isbn', canLink: true });
  });
  it('offers missing ISBN copies ahead of other editions without making title matches exact ownership', () => {
    const result = matchScannedBooks({ isbn: '9780553579901', title: 'Clash of Kings', authors: ['George R.R. Martin'] }, [book('another-edition', { isbn13: '9780306406157' }), book('missing')]);
    expect(result.exactCount).toBe(0); expect(result.matches.map(value => value.id)).toEqual(['missing', 'another-edition']);
    expect(result.matches[0]).toMatchObject({ kind: 'title-author', canLink: true }); expect(result.matches[1].canLink).toBe(false);
  });
  it('keeps multiple candidates available for review and requires compatible author credits', () => {
    const result = matchScannedBooks({ title: 'A Clash of Kings', authors: ['George R. R. Martin'] }, [book('one'), book('two'), book('wrong', { author: { name: 'Someone Else' } })]);
    expect(result.totalMatches).toBe(2); expect(result.matches.every(value => !value.canLink)).toBe(true);
    expect(matchScannedBooks({ title: 'A Clash of Kings' }, [book('author-unknown')]).matches[0].kind).toBe('possible');
  });
  it('does not fuzzy-match different physical parts, book numbers or omnibus versus single editions', () => {
    for (const [left, right] of [['The Reality Dysfunction Part 1: Emergence', 'The Reality Dysfunction Part 2: Expansion'], ['Novel Book 1', 'Novel Book 2'], ['Very Long Novel Title', 'Very Long Novel Title Omnibus']]) {
      expect(matchScannedBooks({ title: left, authors: ['An Author'] }, [book('wrong-part', { title: right, author: { name: 'An Author' } })]).matches).toEqual([]);
    }
    expect(matchScannedBooks({ title: 'Novel Part 1: Emergence', authors: ['An Author'] }, [book('same', { title: 'Novel Part I: Emergence', author: { name: 'An Author' } })]).matches[0].kind).toBe('title-author');
  });
  it('labels partial coauthor credits as a suggestion and never replaces a conflicting ISBN-10', () => {
    const result = matchScannedBooks({ isbn: '9780553579901', title: 'Shared Novel', authors: ['Arthur C. Clarke'] }, [book('shared', { title: 'Shared Novel', author: { name: 'Arthur C. Clarke & Larry Niven' }, isbn10: '0306406152' })]);
    expect(result.matches[0]).toMatchObject({ kind: 'possible', canLink: false });
  });
  it('reports truncation explicitly after considering the whole library', () => {
    const rows = Array.from({ length: 600 }, (_, i) => book(`book-${String(i).padStart(4, '0')}`, i < 588 ? { title: 'Unrelated book', author: { name: 'Someone Else' } } : {}));
    const result = matchScannedBooks({ title: 'A Clash of Kings', authors: ['George R. R. Martin'] }, rows);
    expect(result.totalMatches).toBe(12); expect(result.matches).toHaveLength(10);
  });
});
