import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { LetterShelf } from '@/components/library/letter-shelf';
import { AlphabeticalAuthors } from '@/components/library/alphabetical-authors';
const authors = [{ id: 'pratchett', name: 'Terry Pratchett', books: [{ id: 'later', title: 'The Light Fantastic', seriesName: 'Discworld', seriesNumber: 2, coverUrl: 'https://covers.openlibrary.org/b/id/42-L.jpg' }, { id: 'first', title: 'The Colour of Magic', seriesName: 'Discworld', seriesNumber: 1 }] }, { id: 'pullman', name: 'Philip Pullman', books: [{ id: 'pullman-book', title: 'Northern Lights' }] }];
const originalTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');
let frames: Map<number, FrameRequestCallback>, nextFrame: number;
beforeEach(() => {
  frames = new Map(); nextFrame = 0;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(callback => { frames.set(++nextFrame, callback); return nextFrame; });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => { frames.delete(id); });
  vi.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(900);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 400 } as DOMRect);
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn(function(this: HTMLElement, options: ScrollToOptions) { this.scrollLeft = Math.max(0, Math.min(this.scrollWidth - this.clientWidth, options.left ?? 0)); fireEvent.scroll(this); }) });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); if (originalTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalTo); else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo'); });
const pointer = (row: HTMLElement, x: number, pointerType = 'mouse', buttons = 0) => {
  const event = new Event('pointermove', { bubbles: true }); Object.assign(event, { clientX: x, pointerType, buttons }); fireEvent(row, event);
};
const tick = (time = 16) => { const entry = frames.entries().next().value; if (!entry) throw new Error('No animation frame'); frames.delete(entry[0]); act(() => entry[1](time)); };
const caption = () => screen.getByRole('status', { name: 'Focused book under P' });
describe('letter book carousels', () => {
  it('shows one left-aligned row per letter with no preselected or dimmed books', () => {
    render(<AlphabeticalAuthors authors={authors} groupBySeries view="shelves" />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    expect(screen.getAllByRole('list')).toHaveLength(1); expect(screen.getByRole('heading', { name: 'P 2 authors' })).toBeDefined();
    expect(within(row).getAllByRole('link').map(link => link.getAttribute('href'))).toEqual(['/library/book/first', '/library/book/later', '/library/book/pullman-book']);
    expect(row.scrollLeft).toBe(0); expect(row.className).not.toContain('padding-inline');
    expect(within(row).getAllByRole('link').every(link => !link.hasAttribute('aria-current') && !link.className.includes('opacity-60'))).toBe(true);
    expect(caption().textContent).toBe('3 books'); expect(frames.size).toBe(0);
    expect(screen.getByAltText('The Light Fantastic').getAttribute('loading')).toBe('lazy');
    expect(screen.getByRole('button', { name: 'Jump to P' }).hasAttribute('disabled')).toBe(false);
  });
  it('shows the hovered book’s title/author/series and clears them when hover leaves', () => {
    render(<LetterShelf letter="P" authors={authors} groupBySeries />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    const last = within(row).getByRole('link', { name: 'Northern Lights by Philip Pullman' });
    fireEvent.mouseEnter(last); expect(caption().textContent).toContain('Northern Lights'); expect(caption().textContent).toContain('Philip Pullman');
    fireEvent.mouseLeave(last); expect(caption().textContent).toBe('3 books');
    fireEvent.mouseEnter(within(row).getByRole('link', { name: 'The Colour of Magic by Terry Pratchett' })); expect(caption().textContent).toContain('Discworld #1');
    expect(last.getAttribute('href')).toBe('/library/book/pullman-book');
  });
  it('scrolls continuously in either edge zone and stops when the pointer returns to the middle', () => {
    render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />); const row = screen.getByRole('list', { name: 'Books under P' });
    pointer(row, 395); expect(frames.size).toBe(1); tick(); expect(row.scrollLeft).toBeGreaterThan(0);
    pointer(row, 200); expect(frames.size).toBe(0);
    row.scrollLeft = 100; pointer(row, 5); tick(32); expect(row.scrollLeft).toBeLessThan(100);
    expect(caption().textContent).toBe('3 books');
  });
  it('stops at row boundaries, on pointer exit, page blur and unmount', () => {
    const { unmount } = render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />); const row = screen.getByRole('list', { name: 'Books under P' });
    row.scrollLeft = 500; pointer(row, 399); tick(); expect(row.scrollLeft).toBe(500); expect(frames.size).toBe(0);
    pointer(row, 1); tick(); fireEvent.pointerOut(row, { relatedTarget: document.body }); expect(frames.size).toBe(0);
    pointer(row, 1); fireEvent.blur(window); expect(frames.size).toBe(0);
    pointer(row, 1); unmount(); expect(frames.size).toBe(0);
  });
  it('leaves touch/drag gestures to native scrolling and stops on pointer down or a wheel gesture', () => {
    render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />); const row = screen.getByRole('list', { name: 'Books under P' });
    pointer(row, 399, 'touch'); expect(frames.size).toBe(0); pointer(row, 399, 'mouse', 1); expect(frames.size).toBe(0);
    pointer(row, 399); fireEvent.pointerDown(row); expect(frames.size).toBe(0);
    pointer(row, 399); fireEvent.wheel(row); expect(frames.size).toBe(0);
  });
  it('keeps keyboard navigation and book details accessible without centering or selecting on scroll', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true })); render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    fireEvent.keyDown(row, { key: 'ArrowRight' }); expect(row.scrollTo).toHaveBeenCalledWith({ left: 320, behavior: 'auto' }); expect(caption().textContent).toBe('3 books');
    fireEvent.keyDown(row, { key: 'End' }); expect(row.scrollLeft).toBe(500); fireEvent.keyDown(row, { key: 'Home' }); expect(row.scrollLeft).toBe(0);
    const last = within(row).getByRole('link', { name: 'Northern Lights by Philip Pullman' }); act(() => last.focus()); expect(caption().textContent).toContain('Philip Pullman'); expect(last.hasAttribute('aria-current')).toBe(false);
    act(() => last.blur()); expect(caption().textContent).toBe('3 books');
  });
  it('does not retain removed book metadata and preserves the author-list view', () => {
    const { rerender } = render(<AlphabeticalAuthors authors={authors} groupBySeries={false} view="shelves" />);
    fireEvent.mouseEnter(screen.getByRole('link', { name: 'Northern Lights by Philip Pullman' }));
    rerender(<AlphabeticalAuthors authors={[authors[0]]} groupBySeries={false} view="shelves" />); expect(caption().textContent).not.toContain('Philip Pullman');
    rerender(<AlphabeticalAuthors authors={[authors[0]]} groupBySeries={false} view="list" />); expect(screen.queryByRole('list', { name: 'Books under P' })).toBeNull(); expect(screen.getByRole('button', { name: /Terry Pratchett/ })).toBeDefined();
  });
  it('pages faster with buttons, stops edge scrolling, and disables controls at the bounds', () => {
    render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    const previous = screen.getByRole('button', { name: 'Previous books under P' }), next = screen.getByRole('button', { name: 'Next books under P' });
    expect(previous.hasAttribute('disabled')).toBe(true); expect(next.getAttribute('aria-controls')).toBe(row.id);
    pointer(row, 395); expect(frames.size).toBe(1);
    fireEvent.click(next); expect(frames.size).toBe(0); expect(row.scrollTo).toHaveBeenCalledWith({ left: 360, behavior: 'smooth' }); expect(previous.hasAttribute('disabled')).toBe(false);
    fireEvent.click(next); expect(row.scrollLeft).toBe(500); expect(next.hasAttribute('disabled')).toBe(true);
    fireEvent.click(previous); expect(row.scrollLeft).toBe(140);
    fireEvent.click(previous); expect(row.scrollLeft).toBe(0); expect(previous.hasAttribute('disabled')).toBe(true);
    expect(caption().textContent).toBe('3 books');
  });
  it('hides unnecessary buttons when the row fits and respects reduced motion for button paging', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    render(<LetterShelf letter="P" authors={authors} groupBySeries={false} />);
    const row = screen.getByRole('list', { name: 'Books under P' });
    fireEvent.click(screen.getByRole('button', { name: 'Next books under P' }));
    expect(row.scrollTo).toHaveBeenCalledWith({ left: 360, behavior: 'auto' });
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400); row.scrollLeft = 0; fireEvent.resize(window);
    expect(screen.queryByRole('button', { name: 'Next books under P' })).toBeNull();
  });

});
