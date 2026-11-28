import { afterEach, describe, expect, it, vi } from 'vitest';
import { googleBooks } from '@/lib/metadata/google-books';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe('Google Books language and credential handling', () => {
  it('uses the configured server key and English restriction for general searches', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'test-only-key');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [] }) }); vi.stubGlobal('fetch', fetcher);
    await googleBooks.search('A Novel');
    const params = new URL(fetcher.mock.calls[0][0]).searchParams; expect(params.get('key')).toBe('test-only-key'); expect(params.get('langRestrict')).toBe('en');
  });
  it('uses the key without excluding a physical ISBN’s non-English edition', async () => {
    vi.stubEnv('GOOGLE_BOOKS_API_KEY', 'test-only-key');
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ volumeInfo: { title: 'My German copy', language: 'de', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780306406157' }] } }] }) }); vi.stubGlobal('fetch', fetcher);
    expect(await googleBooks.lookupByIsbn('9780306406157')).toMatchObject({ title: 'My German copy', isbn13: '9780306406157' });
    const params = new URL(fetcher.mock.calls[0][0]).searchParams; expect(params.get('key')).toBe('test-only-key'); expect(params.has('langRestrict')).toBe(false);
  });
  it('skips unverified or wrong-ISBN search hits and selects the matching edition', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [
      { volumeInfo: { title: 'Unverified title' } },
      { volumeInfo: { title: 'Wrong book', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780451187840' }] } },
      { volumeInfo: { title: 'A Clash of Kings', industryIdentifiers: [{ type: 'ISBN_10', identifier: '0553579908' }] } },
    ] }) }));
    expect(await googleBooks.lookupByIsbn('9780553579901')).toMatchObject({ title: 'A Clash of Kings', isbn13: '9780553579901', isbn10: '0553579908' });
  });
  it('returns no metadata when every search hit lacks the requested ISBN', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ items: [{ volumeInfo: { title: 'Wrong title', industryIdentifiers: [{ type: 'ISBN_13', identifier: '9780451187840' }] } }] }) }));
    expect(await googleBooks.lookupByIsbn('9780553579901')).toBeNull();
  });

});
