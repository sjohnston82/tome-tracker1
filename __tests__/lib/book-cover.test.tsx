import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { BookCover } from '@/components/library/book-cover'
import { coverImageUrl } from '@/lib/books/cover-image'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
const url = 'https://covers.openlibrary.org/b/id/42-L.jpg?default=false'
describe('cover image rendering', () => {
  it('shows an already cached image without waiting for another load event', () => {
    vi.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true)
    vi.spyOn(HTMLImageElement.prototype, 'naturalWidth', 'get').mockReturnValue(180)
    vi.spyOn(HTMLImageElement.prototype, 'naturalHeight', 'get').mockReturnValue(280)
    render(<BookCover url={url} title="A Novel" thumbnail />)
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.getByAltText('A Novel').className).toContain('opacity-100')
  })
  it('shows a loading skeleton until a real image loads, and restarts it for a new URL', () => {
    const { rerender } = render(<BookCover url={url} title="A Novel" thumbnail />)
    expect(screen.getByRole('status', { name: 'Loading cover for A Novel' })).toBeDefined()
    const image = screen.getByAltText('A Novel')
    Object.defineProperty(image, 'naturalWidth', { value: 180 })
    Object.defineProperty(image, 'naturalHeight', { value: 280 })
    fireEvent.load(image)
    expect(screen.queryByRole('status')).toBeNull()
    rerender(<BookCover url="https://covers.openlibrary.org/b/id/99-L.jpg" title="A Novel" thumbnail />)
    expect(screen.getByRole('status', { name: 'Loading cover for A Novel' })).toBeDefined()
    fireEvent.error(screen.getByAltText('A Novel'))
    fireEvent.error(screen.getByAltText('A Novel'))
    expect(screen.queryByRole('status')).toBeNull()
  })
  it('uses lazy smaller library thumbnails without modifying the stored URL', () => {
    render(<BookCover url={url} title="A Novel" thumbnail />)
    const image = screen.getByAltText('A Novel')
    expect(image.getAttribute('src')).toContain('42-M.jpg?default=false')
    expect(image.getAttribute('loading')).toBe('lazy')
    expect(url).toContain('42-L.jpg')
  })
  it('falls back to the original cached image, then a meaningful placeholder on failure', () => {
    render(<BookCover url={url} title="A Novel" thumbnail />)
    fireEvent.error(screen.getByAltText('A Novel'))
    expect(screen.getByAltText('A Novel').getAttribute('src')).toBe(url)
    fireEvent.error(screen.getByAltText('A Novel'))
    expect(screen.getByRole('img', { name: 'Cover unavailable for A Novel' })).toBeDefined()
  })
  it('detects a provider blank pixel and lets the user retry without changing the saved choice', () => {
    render(<BookCover url={url} title="A Novel" retry />)
    const image = screen.getByAltText('A Novel')
    Object.defineProperty(image, 'naturalWidth', { value: 1 })
    Object.defineProperty(image, 'naturalHeight', { value: 1 })
    fireEvent.load(image)
    expect(screen.getByRole('img', { name: 'Cover unavailable for A Novel' })).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: 'Retry image' }))
    expect(screen.getByAltText('A Novel').getAttribute('src')).toContain('tome_retry=1')
  })
  it('preserves non-Open-Library URLs and recovers when the saved URL changes', () => {
    expect(coverImageUrl('https://books.google.com/books/content?id=42', true)).toBe('https://books.google.com/books/content?id=42')
    const { rerender } = render(<BookCover url={url} title="A Novel" />)
    fireEvent.error(screen.getByAltText('A Novel'))
    rerender(<BookCover url="https://covers.openlibrary.org/b/id/99-L.jpg" title="A Novel" />)
    expect(screen.getByAltText('A Novel').getAttribute('src')).toContain('99-L.jpg')
  })
})
