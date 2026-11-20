import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { AuthorShelf } from '@/components/library/author-shelf';
import { AlphabeticalAuthors } from '@/components/library/alphabetical-authors';
const author = { id: 'author', name: 'Terry Pratchett', books: [{ id: 'later', title: 'The Light Fantastic', publicationYear: 1986, seriesName: 'Discworld', seriesNumber: 2, coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' }, { id: 'first', title: 'The Colour of Magic', publicationYear: 1983, seriesName: 'Discworld', seriesNumber: 1 }] };
const originalBy = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollBy');
const originalTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollBy', { configurable: true, value: vi.fn(function(this: HTMLElement, options: ScrollToOptions) { this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, this.scrollLeft + (options.left ?? 0))); fireEvent.scroll(this); }) });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn(function(this: HTMLElement, options: ScrollToOptions) { this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, options.left ?? 0)); fireEvent.scroll(this); }) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); if (originalBy) Object.defineProperty(HTMLElement.prototype, 'scrollBy', originalBy); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollBy'); if (originalTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalTo); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo'); });
const overflow = () => { vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400); vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(1200); };
describe('author book shelves', () => {
  it('shows cover rows with title, author and optional series captions and preserves sorting', () => {
    const { rerender } = render(<AuthorShelf author={author} groupBySeries bookSort="series" />);
    const row = screen.getByRole('list', { name: 'Books by Terry Pratchett' });
    expect(within(row).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/library/book/first', '/library/book/later']);
    expect(within(row).getAllByText('Terry Pratchett')).toHaveLength(2); expect(within(row).getByText('Discworld #1')).toBeDefined();
    const image = screen.getByAltText('The Light Fantastic'); expect(image.getAttribute('loading')).toBe('lazy'); expect(image.getAttribute('src')).toContain('42-M.jpg');
    expect(screen.getByRole('img', { name: 'No cover for The Colour of Magic' })).toBeDefined();
    rerender(<AuthorShelf author={author} groupBySeries={false} bookSort="year" />);
    expect(screen.queryByText('Discworld #1')).toBeNull(); expect(author.books[0].id).toBe('later');
  });
  it('scrolls with row controls and keyboard, updating disabled states at each end', () => {
    overflow(); render(<AuthorShelf author={author} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books by Terry Pratchett' });
    const previous = screen.getByRole('button', { name: 'Previous books by Terry Pratchett' }), next = screen.getByRole('button', { name: 'Next books by Terry Pratchett' });
    expect(previous.hasAttribute('disabled')).toBe(true); expect(next.hasAttribute('disabled')).toBe(false);
    fireEvent.click(next); expect(row.scrollBy).toHaveBeenCalledWith({ left: 340, behavior: 'smooth' }); expect(previous.hasAttribute('disabled')).toBe(false);
    fireEvent.keyDown(row, { key: 'End' }); expect(next.hasAttribute('disabled')).toBe(true);
    fireEvent.click(previous); expect(next.hasAttribute('disabled')).toBe(false);
    fireEvent.keyDown(row, { key: 'Home' }); expect(previous.hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(row, { key: 'ArrowRight' }); expect(row.scrollLeft).toBe(340);
    fireEvent.keyDown(row, { key: 'ArrowLeft' }); expect(row.scrollLeft).toBe(0);
  });
  it('respects reduced motion and leaves key events on book links alone', () => {
    overflow(); vi.stubGlobal('matchMedia', () => ({ matches: true })); render(<AuthorShelf author={author} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books by Terry Pratchett' });
    fireEvent.keyDown(row, { key: 'ArrowRight' }); expect(row.scrollBy).toHaveBeenCalledWith({ left: 340, behavior: 'auto' });
    vi.mocked(row.scrollBy).mockClear(); fireEvent.keyDown(within(row).getAllByRole('link')[0], { key: 'ArrowRight' }); expect(row.scrollBy).not.toHaveBeenCalled();
  });
  it('hides unnecessary arrows when the row fits, while retaining alphabet navigation', () => {
    render(<AlphabeticalAuthors authors={[author]} groupBySeries={false} view="shelves" />);
    expect(screen.queryByRole('button', { name: 'Next books by Terry Pratchett' })).toBeNull();
    expect(screen.getByRole('heading', { level: 2, name: 'P 1 author' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Jump to P' }).hasAttribute('disabled')).toBe(false);
    expect(screen.queryByRole('button', { name: /^Terry Pratchett/ })).toBeNull();
    expect(screen.getByRole('list', { name: 'Books by Terry Pratchett' })).toBeDefined();
  });
});
