import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ThemeProvider, useTheme } from '@/lib/hooks/useTheme'
import { THEME_BOOTSTRAP } from '@/lib/theme'
let dark = false
let listeners: Set<() => void>
beforeEach(() => {
  localStorage.clear(); document.documentElement.classList.remove('dark'); listeners = new Set(); dark = false
  vi.stubGlobal('matchMedia', vi.fn(() => ({ get matches() { return dark }, addEventListener: (_: string, fn: () => void) => listeners.add(fn), removeEventListener: (_: string, fn: () => void) => listeners.delete(fn) })))
})
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); localStorage.clear() })
function Controls() {
  const { theme, setTheme, storageError } = useTheme()
  return <><p>{theme}</p>{['light', 'dark', 'system'].map(value => <button key={value} onClick={() => setTheme(value as 'light' | 'dark' | 'system')}>{value} theme</button>)}{storageError && <p role="status">{storageError}</p>}</>
}
describe('application-wide theme preferences', () => {
  it('applies stored choices on any page and persists changes across remounts', () => {
    localStorage.setItem('theme', 'dark')
    const view = render(<ThemeProvider><Controls /></ThemeProvider>)
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'light theme' }))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(document.documentElement.style.colorScheme).toBe('light')
    expect(localStorage.getItem('theme')).toBe('light')
    view.unmount()
    render(<ThemeProvider><Controls /></ThemeProvider>)
    expect(screen.getByText('light')).toBeDefined()
  })
  it('follows OS changes only in system mode, and reacts to another tab', () => {
    render(<ThemeProvider><Controls /></ThemeProvider>)
    act(() => { dark = true; listeners.forEach(fn => fn()) })
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'light theme' }))
    act(() => listeners.forEach(fn => fn()))
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    fireEvent(window, new StorageEvent('storage', { key: 'theme', newValue: 'dark' }))
    expect(screen.getByText('dark')).toBeDefined()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
  it('still applies a theme when browser storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Blocked') })
    render(<ThemeProvider><Controls /></ThemeProvider>)
    fireEvent.click(screen.getByRole('button', { name: 'dark theme' }))
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByRole('status').textContent).toContain('could not save')
  })
  it('uses the saved theme before first paint and ignores invalid stored values', () => {
    localStorage.setItem('theme', 'dark')
    new Function(THEME_BOOTSTRAP)()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    localStorage.setItem('theme', 'invalid')
    new Function(THEME_BOOTSTRAP)()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })
})
