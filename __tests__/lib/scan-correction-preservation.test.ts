import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), upsert: vi.fn(), update: vi.fn(), updateMany: vi.fn(), cover: vi.fn(), lookup: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { book: { findUnique: mocks.findUnique, findMany: mocks.findMany, create: mocks.create, update: mocks.update, updateMany: mocks.updateMany }, author: { upsert: mocks.upsert } } }));
vi.mock('@/lib/metadata/covers', () => ({ findBookCover: mocks.cover }));
vi.mock('@/lib/metadata', () => ({ lookupByIsbn: mocks.lookup }));
import { createBook } from '@/lib/books/service';
import { createBookSchema } from '@/lib/books/validation';
import { enrichUserBooks } from '@/lib/enrichment/service';
beforeEach(() => { vi.clearAllMocks(); mocks.findUnique.mockResolvedValue(null); mocks.upsert.mockResolvedValue({ id: 'author' }); mocks.create.mockImplementation(async ({ data }) => ({ id: 'new', ...data })); });
describe('preserving scan catalog corrections', () => {
  it('locks manually selected scan artwork, including an intentionally missing cover, before any automatic lookup', async () => {
    const input = createBookSchema.parse({ title: 'Lake Wobegon Summer 1956', authorName: 'Garrison Keillor', isbn13: '9780670030033', source: 'SCAN', coverLocked: true });
    await createBook('owner', input, true);
    expect(mocks.cover).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: 'owner', title: 'Lake Wobegon Summer 1956', coverLocked: true, coverUrl: null }) }));
  });
  it('does not enrich corrected titles with another book’s publisher, publication year, genres or cover', async () => {
    mocks.findMany.mockResolvedValue([{ id: 'book', title: 'Lake Wobegon Summer 1956', isbn13: '9780670030033', publisher: null, coverUrl: null, coverLocked: true, publicationYear: null, genres: [] }]);
    mocks.lookup.mockResolvedValue({ title: 'Synaptic Self', authors: ['Joseph LeDoux'], publisher: 'Wrong publisher', publishedYear: 2002, subjects: ['Neuroscience'], coverUrl: 'https://covers.openlibrary.org/b/id/1-L.jpg' });
    expect(await enrichUserBooks('owner')).toEqual({ processed: 1, enriched: 0, errors: 0 });
    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ userId: 'owner' }) }));
    expect(mocks.update).not.toHaveBeenCalled(); expect(mocks.updateMany).not.toHaveBeenCalled();
  });
});
