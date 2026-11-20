import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LetterShelf } from '@/components/library/letter-shelf';
import { AlphabeticalAuthors } from '@/components/library/alphabetical-authors';
const authors = [{ id: 'pratchett', name: 'Terry Pratchett', books: [{ id: 'later', title: 'The Light Fantastic', seriesName: 'Discworld', seriesNumber: 2, coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' }, { id: 'first', title: 'The Colour of Magic', seriesName: 'Discworld', seriesNumber: 1 }] }, { id: 'pullman', name: 'Philip Pullman', books: [{ id: 'pullman-book', title: 'Northern Lights' }] }];
const originalTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
beforeEach(() => {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(656);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    const parent = this.parentElement;
    if (this.hasAttribute('data-book-id') && parent) { const index = Array.from(parent.children).indexOf(this); return { left: 144 + index * 128 - parent.scrollLeft, width: 112 } as DOMRect; }
    return { left: 0, width: 400 } as DOMRect;
  });
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn(function(this: HTMLElement, options: ScrollToOptions) { this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, options.left ?? 0)); fireEvent.scroll(this); }) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); if (originalTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalTo); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo'); });
describe('letter book carousels', () => {
  it('combines authors into exactly one cover row per letter with a shared focused caption', () => {
    render(<AlphabeticalAuthors authors={authors} groupBySeries view="shelves" />);
    expect(screen.getAllByRole('list')).toHaveLength(1); expect(screen.getByRole('heading', { level: 2, name: 'P 2 authors' })).toBeDefined();
    const row = screen.getByRole('list', { name: 'Books under P' });
    expect(within(row).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/library/book/first', '/library/book/later', '/library/book/pullman-book']);
    const caption = screen.getByRole('status', { name: 'Focused book under P' }); expect(caption.textContent).toContain('The Colour of Magic'); expect(caption.textContent).toContain('Terry Pratchett'); expect(caption.textContent).toContain('Discworld #1');
    expect(within(row).queryByText('Terry Pratchett')).toBeNull(); expect(screen.getByAltText('The Light Fantastic').getAttribute('loading')).toBe('lazy');
    expect(screen.getByRole('button', { name: 'Jump to P' }).hasAttribute('disabled')).toBe(false);
  });
  it('updates the title and author on hover and keyboard focus without changing cover links', () => {
    render(<LetterShelf letter="P" authors={authors} groupBySeries />);
    const row = screen.getByRole('list', { name: 'Books under P' }), caption = screen.getByRole('status', { name: 'Focused book under P' });
    const last = within(row).getByRole('link', { name: 'Northern Lights by Philip Pullman' });
    fireEvent.mouseEnter(last); expect(caption.textContent).toContain('Northern Lights'); expect(caption.textContent).toContain('Philip Pullman'); expect(caption.textContent).toContain('3 of 3 books');
    const first = within(row).getByRole('link', { name: 'The Colour of Magic by Terry Pratchett' });
    act(() => first.focus()); expect(caption.textContent).toContain('Terry Pratchett'); expect(caption.textContent).toContain('The Colour of Magic'); expect(first.getAttribute('aria-current')).toBe('true');
    expect(last.getAttribute('href')).toBe('/library/book/pullman-book');
  });
  it('tracks the nearest centered cover during native scrolling, including crossing authors', () => {
    render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    row.scrollLeft = 128; fireEvent.scroll(row); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('The Light Fantastic');
    row.scrollLeft = 256; fireEvent.scroll(row); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('Philip Pullman'); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('Northern Lights');
  });
  it('moves one book at a time with arrows, Home and End and disables boundary controls', () => {
    render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    const previous = screen.getByRole('button', { name: 'Previous book under P' }), next = screen.getByRole('button', { name: 'Next book under P' });
    expect(previous.hasAttribute('disabled')).toBe(true);
    fireEvent.click(next); expect(row.scrollTo).toHaveBeenCalledWith({ left: 128, behavior: 'smooth' }); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('2 of 3 books');
    fireEvent.keyDown(row, { key: 'End' }); expect(next.hasAttribute('disabled')).toBe(true); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('Philip Pullman');
    fireEvent.click(previous); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('2 of 3 books');
    fireEvent.keyDown(row, { key: 'Home' }); expect(previous.hasAttribute('disabled')).toBe(true);
    fireEvent.keyDown(row, { key: 'ArrowRight' }); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('2 of 3 books');
    fireEvent.keyDown(row, { key: 'ArrowLeft' }); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('1 of 3 books');
  });
  it('respects reduced motion and handles removed focused books without stale captions', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    const { rerender } = render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    fireEvent.keyDown(row, { key: 'End' }); expect(row.scrollTo).toHaveBeenCalledWith({ left: 256, behavior: 'auto' });
    rerender(<LetterShelf letter="P" authors={[authors[0]]} groupBySeries={false} />);
    expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).not.toContain('Philip Pullman'); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('Terry Pratchett');
  });
  it('omits arrow controls for a single book and preserves the original list layout', () => {
    const single = { ...authors[1] };
    const { rerender } = render(<AlphabeticalAuthors authors={[single]} groupBySeries={false} view="shelves" />);
    expect(screen.queryByRole('button', { name: 'Next book under P' })).toBeNull(); expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('Northern Lights');
    rerender(<AlphabeticalAuthors authors={[single]} groupBySeries={false} view="list" />);
    expect(screen.queryByRole('list', { name: 'Books under P' })).toBeNull(); expect(screen.getByRole('button', { name: /Philip Pullman/ })).toBeDefined();
  });
  it('keeps the selected caption stable during smooth scrolling, while manual scrolling can interrupt it', () => {
    render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    vi.mocked(row.scrollTo).mockImplementationOnce(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Next book under P' }));
    fireEvent.scroll(row); // Animation has not yet reached the next center.
    expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('The Light Fantastic');
    fireEvent.wheel(row); row.scrollLeft = 0; fireEvent.scroll(row);
    expect(screen.getByRole('status', { name: 'Focused book under P' }).textContent).toContain('The Colour of Magic');
  });

});
