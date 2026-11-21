import { collectionFixture, bookKey, workKey, missingKey } from './collection';
import type { ReviewSnapshot } from '@/lib/review/queue';
export function reviewFixture(): ReviewSnapshot {
  const manifest = collectionFixture(); manifest.books[0].publicationYear = 1952;
  manifest.review.push({ code: 'OWNERSHIP_MISMATCH', sourceKey: missingKey, title: 'Second Novel', message: 'Checklist says OWNED; Excel matched 0 physical books. Ownership remains derived from Excel.' });
  const date = '2026-11-21T12:00:00.000Z';
  return {
    books: [{ id: 'book', title: 'An Omnibus', author: { name: 'An Author' }, publicationYear: 2005, readingStatus: 'UNREAD', coverUrl: null, coverLocked: true, isbn13: null, isbn10: null, importKey: bookKey, updatedAt: date, workId: null, contents: [{ workId: 'owned-work' }], readingSessions: [] }],
    works: [{ id: 'owned-work', title: 'First Novella', authorName: 'An Author', publicationYear: 2000, importKey: workKey, updatedAt: date }, { id: 'unowned-work', title: 'Second Novel', authorName: 'An Author', publicationYear: null, importKey: missingKey, updatedAt: date }],
    entries: [{ id: 'entry', workId: 'owned-work', position: '0.5', entryType: 'NOVELLA', isConfirmed: false, series: { id: 'series', name: 'A Series' } }],
    imports: [{ id: 'import', dataset: 'tome-collection', manifest, report: {}, updatedAt: date }],
  };
}
