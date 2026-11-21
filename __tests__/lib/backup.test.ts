// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { backupSchema } from '@/lib/backup/validation';
import { libraryCSV } from '@/lib/backup/service';
const dates = { createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };
const fixture = () => ({ format: 'tome-tracker-backup', version: 1, exportedAt: dates.createdAt, authors: [{ id: 'a', name: '=DANGEROUS()', bio: null, photoUrl: null, externalSource: null, externalId: null, ...dates }], works: [], books: [{ id: 'b', authorId: 'a', title: 'A "quoted", book', isbn13: null, isbn10: null, publisher: null, publicationYear: 1952, coverUrl: null, coverLocked: true, seriesName: null, seriesNumber: null, workId: null, readingStatus: 'READING', importKey: null, tags: [], genres: [], source: 'IMPORT', ...dates }], series: [], entries: [], contents: [], sessions: [], logs: [], imports: [] });
describe('restorable backup validation', () => {
  it('preserves corrected metadata and strips account credentials/foreign ownership fields', () => {
    const input = fixture(); const parsed = backupSchema.parse({ ...input, passwordHash: 'secret', books: [{ ...input.books[0], userId: 'other' }] });
    expect(parsed.books[0].coverLocked).toBe(true); expect(parsed.books[0].publicationYear).toBe(1952);
    expect(parsed.books[0]).not.toHaveProperty('userId'); expect(parsed).not.toHaveProperty('passwordHash');
  });
  it('rejects duplicate records and dangling relationships before restore', () => {
    const input = fixture(); expect(backupSchema.safeParse({ ...input, books: [...input.books, ...input.books] }).success).toBe(false);
    expect(backupSchema.safeParse({ ...input, authors: [] }).success).toBe(false);
    expect(backupSchema.safeParse({ ...input, format: 'other', version: 2 }).success).toBe(false);
  });
  it('quotes CSV fields and neutralizes spreadsheet formula injection', () => {
    const csv = libraryCSV(backupSchema.parse(fixture())); expect(csv).toContain('"A ""quoted"", book"'); expect(csv).toContain('"\'=DANGEROUS()"'); expect(csv).toContain('READING');
  });
});
