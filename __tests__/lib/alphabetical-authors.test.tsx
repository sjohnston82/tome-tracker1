import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { AlphabeticalAuthors } from '@/components/library/alphabetical-authors'
const authors = [
  { id: 'p', name: 'Terry Pratchett', books: [{ id: 'book', title: 'A Novel' }] },
  { id: 'c', name: 'Arthur C. Clarke', books: [] },
  { id: 's', name: 'Arkady & Boris Strugatsky', books: [] },
]
const originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView')
beforeEach(() => { Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() }) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll); else Reflect.deleteProperty(Element.prototype, 'scrollIntoView') })
describe('library alphabet navigation', () => {
  it('renders stacked expandable author cards under surname headings', () => {
    render(<AlphabeticalAuthors authors={authors} groupBySeries={false} />)
    const headings = screen.getAllByRole('heading', { level: 2 })
    expect(headings.map(heading => heading.textContent)).toEqual(['C 1 author', 'P 1 author', 'S 1 author'])
    expect(screen.queryByText('A Novel')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Arthur C. Clarke' })).toBeDefined()
    expect(screen.getByRole('heading', { name: 'Arkady & Boris Strugatsky' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /Terry Pratchett/ }))
    expect(screen.getByRole('link', { name: /A Novel/ })).toBeDefined()
    const link = screen.getByRole('link', { name: /A Novel/ })
    fireEvent.click(screen.getByRole('button', { name: /Terry Pratchett/ }))
    expect(screen.queryByRole('link', { name: /A Novel/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Terry Pratchett/ }))
    expect(screen.getByRole('link', { name: /A Novel/ })).toBe(link)
  })
  it('jumps to an available letter and disables letters absent from filtered results', () => {
    const { rerender } = render(<AlphabeticalAuthors authors={authors} groupBySeries={false} />)
    expect(screen.getByRole('button', { name: 'Jump to A' }).hasAttribute('disabled')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Jump to S' }))
    const heading = screen.getByRole('heading', { level: 2, name: 'S 1 author' })
    expect(heading.scrollIntoView).toHaveBeenCalled()
    expect(document.activeElement).toBe(heading)
    expect(screen.getByRole('button', { name: 'Jump to S' }).getAttribute('aria-current')).toBe('location')
    rerender(<AlphabeticalAuthors authors={[authors[1]]} groupBySeries={false} />)
    expect(screen.queryByRole('heading', { level: 2, name: 'S 1 author' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Jump to S' }).hasAttribute('disabled')).toBe(true)
  })
  it('updates the active letter as section positions change on scroll', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) { return { top: this.id === 'authors-C' ? -200 : this.id === 'authors-P' ? 80 : 300 } as DOMRect })
    render(<AlphabeticalAuthors authors={authors} groupBySeries={false} />)
    fireEvent.scroll(window)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Jump to P' }).getAttribute('aria-current')).toBe('location'))
  })
})
