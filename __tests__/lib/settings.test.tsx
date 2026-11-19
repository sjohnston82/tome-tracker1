import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
const mocks = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), sync: vi.fn(), clear: vi.fn(), theme: vi.fn(), online: true }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }) }))
vi.mock('@/lib/hooks/useTheme', async () => {
  const { useState } = await import('react')
  return { useTheme: () => { const [theme, change] = useState('system'); return { theme, setTheme: (value: string) => { mocks.theme(value); change(value) }, storageError: null } } }
})
vi.mock('@/lib/hooks/useOfflineLibrary', () => ({ useOfflineLibrary: () => ({ isOnline: mocks.online, cacheStats: { bookCount: 258, authorCount: 72, lastSync: null }, syncAndCache: mocks.sync, clearLocalCache: mocks.clear }) }))
import SettingsPage from '@/app/settings/page'
beforeEach(() => { vi.clearAllMocks(); mocks.online = true; mocks.sync.mockResolvedValue(true); mocks.clear.mockResolvedValue(undefined); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true })) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
describe('settings controls', () => {
  it('connects every theme option', () => {
    render(<SettingsPage />)
    for (const [name, value] of [['Light', 'light'], ['Dark', 'dark'], ['System default', 'system']]) {
      fireEvent.click(screen.getByLabelText(name))
      expect(mocks.theme).toHaveBeenLastCalledWith(value)
    }
  })
  it('reports successful and failed syncs and releases busy state', async () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    await screen.findByText('Library downloaded for offline use.')
    mocks.sync.mockResolvedValue(false)
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    await screen.findByRole('alert')
    expect(screen.getByRole('button', { name: 'Sync now' }).hasAttribute('disabled')).toBe(false)
  })
  it('handles clear-cache errors without reporting success or getting stuck', async () => {
    mocks.clear.mockRejectedValueOnce(new Error('Storage unavailable'))
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Clear library cache' }))
    await screen.findByRole('alert')
    fireEvent.click(screen.getByRole('button', { name: 'Clear library cache' }))
    await screen.findByText(/Local library cache cleared/)
  })
  it('prevents concurrent cache actions while syncing', async () => {
    let done!: (value: boolean) => void
    mocks.sync.mockReturnValue(new Promise(resolve => { done = resolve }))
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sync now' }))
    expect(screen.getByRole('button', { name: 'Clear library cache' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Sign out' }).hasAttribute('disabled')).toBe(true)
    done(true)
    await screen.findByText('Library downloaded for offline use.')
    expect(mocks.sync).toHaveBeenCalledTimes(1)
  })
  it('does not redirect after failed sign-out; clears local data on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await screen.findByRole('alert')
    expect(mocks.replace).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'))
    expect(mocks.clear).toHaveBeenCalledOnce()
    expect(mocks.refresh).toHaveBeenCalledOnce()
  })
  it('warns after successful account action if local cleanup failed', async () => {
    mocks.clear.mockRejectedValue(new Error('Blocked'))
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }))
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login?cacheWarning=1'))
  })
  it('requires confirmation, supports cancel, and shows deletion failures inside the dialog', async () => {
    render(<SettingsPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    expect(screen.getByRole('alertdialog')).toBeDefined()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(fetch).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete account' }))
    vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response)
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await screen.findByRole('alert')
    expect(mocks.replace).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Delete permanently' }))
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith('/login'))
    expect(fetch).toHaveBeenLastCalledWith('/api/account', { method: 'DELETE' })
  })
  it('disables network actions offline but still allows clearing downloaded data', () => {
    mocks.online = false
    render(<SettingsPage />)
    expect(screen.getByRole('button', { name: 'Sync now' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Delete account' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Clear library cache' }).hasAttribute('disabled')).toBe(false)
  })
})
