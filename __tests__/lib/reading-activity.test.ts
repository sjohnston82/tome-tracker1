// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildReadingActivity, validTimeZone, type ActivitySession } from '@/lib/reading/activity';
const now = new Date('2026-11-19T12:00:00Z');
const log = (id: string, page: number, occurredAt: string, createdAt = occurredAt) => ({ id, page, occurredAt, createdAt });
const session = (logs: ActivitySession['logs'] = [], finishedAt: string | null = null): ActivitySession => ({ id: 'session', baselinePage: 224, finishedAt, book: { id: 'book', title: 'A Novel', author: { name: 'An Author' } }, logs });
describe('reading activity calculations', () => {
  it('counts only new highs across year boundaries, excluding the starting page and revisited pages', () => {
    const data = buildReadingActivity([session([log('a', 230, '2025-12-31T12:00:00Z'), log('b', 240, '2026-01-01T12:00:00Z'), log('c', 239, '2026-01-02T12:00:00Z'), log('d', 260, '2026-02-01T12:00:00Z'), log('e', 250, '2026-03-01T12:00:00Z')])], 2026, 'UTC', 155, now);
    expect(data.totals).toMatchObject({ pages: 30, books: 0, activeDays: 2, entries: 4 });
    expect(data.months.slice(0, 3).map(m => m.pages)).toEqual([10, 20, 0]); expect(data.undatedReadBooks).toBe(155); expect(data.availableYears).toEqual([2026, 2025]);
  });
  it('uses the reader’s time zone for month/year/quarter boundaries and daylight-saving days', () => {
    const input = session([log('a', 230, '2026-01-01T00:30:00Z'), log('b', 240, '2026-04-01T00:30:00Z')], '2026-04-01T00:30:00Z');
    const eastern = buildReadingActivity([input], 2026, 'America/New_York', 0, now);
    expect(eastern.months[0].pages).toBe(0); expect(eastern.months[2].pages).toBe(10); expect(eastern.quarters[0].books).toBe(1); expect(eastern.quarters[1].books).toBe(0);
    const utc = buildReadingActivity([input], 2026, 'UTC', 0, now); expect(utc.months[0].pages).toBe(6); expect(utc.quarters[1].books).toBe(1);
    const dst = buildReadingActivity([session([log('a', 230, '2026-11-01T05:30:00Z'), log('b', 240, '2026-11-01T06:30:00Z')])], 2026, 'America/New_York', 0, now); expect(dst.totals.activeDays).toBe(1);
  });
  it('distinguishes unique books and completed reads, with rereads counted as new sessions', () => {
    const first = session([log('a', 250, '2026-01-10T12:00:00Z')], '2026-01-10T12:00:00Z');
    const second = { ...session([log('b', 300, '2026-04-10T12:00:00Z')], '2026-04-10T12:00:00Z'), id: 'reread', baselinePage: 0 };
    const data = buildReadingActivity([first, second], 2026, 'UTC', 0, now);
    expect(data.totals).toMatchObject({ books: 1, completedReads: 2, pages: 326 }); expect(data.quarters[0].books).toBe(1); expect(data.quarters[1].books).toBe(1);
  });
  it('recalculates corrections, deletions and reopened completions without estimating history', () => {
    const original = session([log('a', 260, '2026-01-10T12:00:00Z')], '2026-01-10T12:00:00Z');
    expect(buildReadingActivity([original], 2026, 'UTC', 0, now).totals.pages).toBe(36);
    const corrected = { ...original, finishedAt: null, logs: [log('a', 240, '2026-02-10T12:00:00Z')] };
    const result = buildReadingActivity([corrected], 2026, 'UTC', 0, now); expect(result.totals).toMatchObject({ pages: 16, books: 0 }); expect(result.months[0].pages).toBe(0); expect(result.months[1].pages).toBe(16);
    expect(buildReadingActivity([{ ...corrected, logs: [] }], 2026, 'UTC', 0, now).totals.pages).toBe(0);
  });
  it('uses deterministic timestamp tie-breaking and sorts backdated entries chronologically', () => {
    const data = buildReadingActivity([session([log('z', 250, '2026-02-10T12:00:00Z'), log('a', 240, '2026-01-10T12:00:00Z'), log('b', 245, '2026-01-10T12:00:00Z', '2026-01-11T12:00:00Z')])], 2026, 'UTC', 0, now);
    expect(data.months.slice(0, 2).map(m => m.pages)).toEqual([21, 5]); expect(data.totals.activeDays).toBe(2);
  });
  it('does not fill gaps, count future imported events, or present an unfinished quarter as complete', () => {
    const data = buildReadingActivity([session([log('a', 250, '2026-11-01T12:00:00Z'), log('b', 300, '2027-01-01T12:00:00Z')], '2027-01-01T12:00:00Z')], 2026, 'UTC', 3, now);
    expect(data.totals).toMatchObject({ pages: 26, activeDays: 1, books: 0 }); expect(data.availableYears).toEqual([2026]);
    expect(data.quarters[3].state).toBe('in-progress'); expect(data.quarters[2].state).toBe('complete'); expect(data.quarters[3].averagePagesPerActiveDay).toBe(26);
    expect(data.months[9].pages).toBe(0); expect(data.months[11].pages).toBe(0);
    expect(buildReadingActivity([], 2027, 'UTC', 0, now).quarters[0].state).toBe('upcoming');
  });
  it('handles a completely empty library and validates IANA time zones', () => {
    const data = buildReadingActivity([], 2026, 'UTC', 0, now); expect(data.months).toHaveLength(12); expect(data.totals).toEqual({ pages: 0, books: 0, completedReads: 0, activeDays: 0, entries: 0 }); expect(data.quarters[0].busiestMonth).toBeNull();
    expect(validTimeZone('America/New_York')).toBe(true); expect(validTimeZone('not-a-zone')).toBe(false);
  });
});
