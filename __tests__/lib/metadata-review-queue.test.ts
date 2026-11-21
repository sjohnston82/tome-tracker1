// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildReviewQueue, publicReviewQueue } from '@/lib/review/queue';
import { mergeReviewDecisions, readReviewDecisions } from '@/lib/review/decisions';
import { reviewFixture } from '../fixtures/metadata-review';
import { collectionFixture } from '../fixtures/collection';
describe('metadata review queue and source provenance', () => {
  it('compares live library values to source fields and separates unowned works from physical copies', () => {
    const snapshot = reviewFixture(), queue = buildReviewQueue(snapshot);
    const year = queue.items.find(item => item.code === 'PUBLICATION_CONFLICT' && item.target.kind === 'book')!;
    expect(year).toMatchObject({ current: '2005', proposed: '1952', ownership: 'Owned physical copy', source: 'master.xlsx · Collection · row 2' });
    expect(year.actions).toContain('source');
    expect(queue.items.find(item => item.code === 'MISSING_WORK_YEAR')).toMatchObject({ title: 'Second Novel', ownership: 'Series work — not an owned physical book' });
    expect(queue.items.find(item => item.code === 'OWNERSHIP_MISMATCH')?.actions).toEqual(['keep']);
    expect(publicReviewQueue(queue).items.every(item => !('target' in item))).toBe(true);
  });
  it('preserves intentional blank covers and does not invent completion-date problems for historical Read labels', () => {
    const snapshot = reviewFixture(); snapshot.books[0].readingStatus = 'READ';
    const queue = buildReviewQueue(snapshot);
    expect(queue.items.some(item => item.code === 'MISSING_COVER')).toBe(false);
    expect(queue.items.some(item => /completion|finished/i.test(item.code))).toBe(false);
    expect(queue.items.some(item => item.code === 'MISSING_ISBN')).toBe(true);
  });
  it('keeps decisions across harmless import timestamps but reopens changed source/current values', () => {
    const snapshot = reviewFixture(); const item = buildReviewQueue(snapshot).items.find(item => item.code === 'PUBLICATION_CONFLICT' && item.target.kind === 'book')!;
    snapshot.imports[0].report = { _metadataReview: { [item.id]: { fingerprint: item.fingerprint, state: 'reviewed', resolvedAt: '2026-11-21T13:00:00.000Z' } } };
    snapshot.books[0].updatedAt = '2026-11-21T14:00:00.000Z';
    expect(buildReviewQueue(snapshot).items.find(row => row.id === item.id)?.resolved).toBe(true);
    snapshot.books[0].publicationYear = 2006;
    expect(buildReviewQueue(snapshot).items.find(row => row.id === item.id)?.resolved).toBe(false);
    snapshot.books[0].publicationYear = 1952;
    expect(buildReviewQueue(snapshot).items.some(row => row.id === item.id)).toBe(false);
  });
  it('does not allow source reading-status changes while reading sessions are active', () => {
    const snapshot = reviewFixture(); snapshot.books[0].readingSessions = [{ id: 'active' }];
    const item = buildReviewQueue(snapshot).items.find(item => item.code === 'READING_CONFLICT')!;
    expect(item.actions).toEqual(['keep']); expect(item.message).toContain('active reading session');
  });
  it('treats null series order as unknown rather than a conflicting zero or a confirmed position', () => {
    const snapshot = reviewFixture(); snapshot.entries[0].position = null;
    const manifest = collectionFixture(); manifest.series[0].entries[0].position = null; snapshot.imports[0].manifest = manifest;
    const queue = buildReviewQueue(snapshot);
    expect(queue.items.some(item => item.code === 'ORDER_CONFLICT')).toBe(false);
    expect(queue.items.find(item => item.code === 'UNCONFIRMED_ORDER')?.actions).toEqual([]);
  });
  it('retains a pending ambiguous preview and offers only owned candidates instead of creating copies', () => {
    const snapshot = reviewFixture(); snapshot.books[0].importKey = null; snapshot.books[0].readingStatus = 'READ';
    snapshot.books.push({ ...snapshot.books[0], id: 'second-copy' }); snapshot.imports[0].dataset = 'tome-collection:preview';
    const queue = buildReviewQueue(snapshot), item = queue.items.find(item => item.code === 'AMBIGUOUS_EDITION')!;
    expect(queue.pendingImport).toBe(true); expect(item.blocking).toBe(true); expect(item.actions).toContain('pin'); expect(item.actions).not.toContain('keep');
    expect(item.candidates.map(row => row.id).sort()).toEqual(['book', 'second-copy']);
  });
  it('keeps a newer reopen decision when staging merges an older reviewed import report', () => {
    const id = 'a'.repeat(64), fingerprint = 'b'.repeat(64);
    const old = { _metadataReview: { [id]: { fingerprint, state: 'reviewed', resolvedAt: '2026-11-20T12:00:00.000Z' } } };
    const recent = { _metadataReview: { [id]: { fingerprint, state: 'open', resolvedAt: '2026-11-21T12:00:00.000Z' } } };
    expect(mergeReviewDecisions(recent, old)[id].state).toBe('open');
    expect(readReviewDecisions({ _metadataReview: { malicious: { fingerprint: 'oops' } } })).toEqual({});
  });
  it('fails visibly on an invalid saved manifest while retaining missing-data suggestions', () => {
    const snapshot = reviewFixture(); snapshot.imports[0].manifest = { bad: true };
    expect(buildReviewQueue(snapshot).items.some(item => item.code === 'INVALID_SAVED_IMPORT')).toBe(true);
    expect(buildReviewQueue(snapshot).items.some(item => item.code === 'MISSING_ISBN')).toBe(true);
  });
});
