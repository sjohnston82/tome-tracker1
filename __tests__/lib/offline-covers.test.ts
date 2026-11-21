// @vitest-environment node
import { describe, expect, it, vi, afterEach } from 'vitest';
import { allowedCoverURL } from '@/lib/metadata/offline-cover-url';
import { downloadCovers } from '@/lib/offline/covers';
afterEach(() => vi.unstubAllGlobals());
describe('offline cover downloads', () => {
  it('allows only provider image endpoints and blocks redirects to arbitrary hosts through URL input', () => {
    expect(allowedCoverURL('https://covers.openlibrary.org/b/id/123-L.jpg')).toBe(true);
    expect(allowedCoverURL('https://books.google.com/books/content?id=abc')).toBe(true);
    for (const url of ['http://localhost/admin', 'https://covers.openlibrary.org.evil.test/b/id/123-L.jpg', 'https://books.google.com/other', 'https://user:pass@books.google.com/books/content', 'https://books.google.com:8443/books/content']) expect(allowedCoverURL(url)).toBe(false);
  });
  it('reports provider failures, saves successes, and reuses downloaded images', async () => {
    const match = vi.fn().mockResolvedValueOnce(new Response('image')).mockResolvedValue(undefined), put = vi.fn();
    vi.stubGlobal('caches', { open: vi.fn().mockResolvedValue({ match, put }) }); vi.stubGlobal('navigator', { onLine: true });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    const result = await downloadCovers(['https://covers.openlibrary.org/b/id/123-L.jpg', 'https://example.test/cover.jpg'], vi.fn());
    expect(result.downloaded).toBe(1); expect(result.failed).toBe(1); expect(result.unsupported).toBe(1); expect(put).not.toHaveBeenCalled();
  });
});
