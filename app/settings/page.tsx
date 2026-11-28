"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/hooks/useTheme";
import { useOfflineLibrary } from "@/lib/hooks/useOfflineLibrary";
import { Button } from "@/components/ui/button";

import { PreferenceSettings, BackupSettings, SecuritySettings, OfflineCoverSettings, DiagnosticsSettings } from "@/components/settings/settings-extras";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme, storageError } = useTheme();
  const { cacheStats, cacheError, clearLocalCache, syncAndCache, isOnline } = useOfflineLibrary();

  const [action, setAction] = useState<string | null>(null);
  const actionLock = useRef(false);
  const syncing = action === 'sync', clearing = action === 'clear', deleting = action === 'delete';
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const cancelDelete = useRef<HTMLButtonElement>(null);
  const deleteTrigger = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!showDeleteConfirm) return;
    cancelDelete.current?.focus();
    return () => deleteTrigger.current?.focus();
  }, [showDeleteConfirm]);
  const run = async (name: string, operation: () => Promise<void>) => {
    if (actionLock.current) return;
    actionLock.current = true; setAction(name); setMessage(''); setError('');
    try { await operation(); }
    catch (error) { setError(error instanceof Error ? error.message : 'Unable to complete this action. Please try again.'); }
    finally { actionLock.current = false; setAction(null); }
  };

  const handleSync = async () => {
    await run('sync', async () => {
      if (!await syncAndCache()) throw new Error('Sync failed. Check your connection and try again; your online library has not been changed.');
      setMessage('Library downloaded for offline use.');
    });
  };

  const handleClearCache = async () => {
    await run('clear', async () => {
      try { await clearLocalCache(); }
      catch { throw new Error('Some local cache data could not be cleared. Your online library has not been changed. Please try again.'); }
      setMessage('Local library cache cleared. Your online books and reading history are still saved.');
    });
  };

  const handleLogout = async () => {
    await run('logout', async () => {
      if (!await fetch('/api/auth/logout', { method: 'POST' }).then(response => response.ok)) throw new Error('Sign out failed. Please check your connection and try again.');
      let warning = false;
      try { await clearLocalCache(); } catch { warning = true; }
      router.replace(warning ? '/login?cacheWarning=1' : '/login');
      router.refresh();
    });
  };

  const handleDeleteAccount = async () => {
    await run('delete', async () => {
      const response = await fetch("/api/account", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error('Account deletion failed. Please try again; no success was confirmed.');
      let warning = false;
      try { await clearLocalCache(); } catch { warning = true; }
      router.replace(warning ? '/login?cacheWarning=1' : '/login');
      router.refresh();
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      {error && !showDeleteConfirm && <p role="alert" className="mb-4 text-red-600">{error}</p>}
      {message && <p role="status" className="mb-4 text-green-700 dark:text-green-300">{message}</p>}

      <div className="space-y-6">
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="font-medium text-lg mb-4">Appearance</h2>
          {storageError && <p role="status" className="text-sm text-amber-700 mb-3">{storageError}</p>}

          <div className="space-y-3">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="theme"
                checked={theme === "light"}
                onChange={() => setTheme("light")}
                className="w-4 h-4"
              />
              <span>Light</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="theme"
                checked={theme === "dark"}
                onChange={() => setTheme("dark")}
                className="w-4 h-4"
              />
              <span>Dark</span>
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="theme"
                checked={theme === "system"}
                onChange={() => setTheme("system")}
                className="w-4 h-4"
              />
              <span>System default</span>
            </label>
          </div>
        </section>

        <PreferenceSettings />
        <BackupSettings />
        <OfflineCoverSettings />
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="font-medium text-lg mb-4">Cache & Sync</h2>
          {cacheError && <p role="alert" className="text-sm text-amber-700 mb-3">{cacheError}</p>}
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Download your library for offline use, or remove downloaded book data and cover images from this device. Clearing the cache does not delete your online library or reading history.</p>
          {!isOnline && <p role="status" className="text-sm text-amber-700 mb-3">You are offline. Sync, sign out, and account deletion need a connection.</p>}

          {cacheStats && (
            <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              <p>
                Cached: {cacheStats.bookCount} books, {cacheStats.authorCount} authors
              </p>
              {cacheStats.lastSync && (
                <p>Last synced: {new Date(cacheStats.lastSync).toLocaleString()}</p>
              )}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={handleSync} loading={syncing} disabled={!!action || !isOnline}>
              Sync now
            </Button>
            <Button variant="ghost" onClick={handleClearCache} loading={clearing} disabled={!!action}>
              Clear library cache
            </Button>
          </div>
        </section>

        <SecuritySettings />
        <DiagnosticsSettings />
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="font-medium text-lg mb-4">Account</h2>

          <div className="space-y-4">
            <Button variant="secondary" onClick={handleLogout} loading={action === 'logout'} disabled={!!action || !isOnline}>
              Sign out
            </Button>

            <div className="pt-4 border-t dark:border-gray-700">
              <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Permanently delete your account and all your library data.
              </p>
              <Button ref={deleteTrigger} variant="danger" disabled={!!action || !isOnline} onClick={() => { setError(''); setShowDeleteConfirm(true); }}>
                Delete account
              </Button>
            </div>
          </div>
        </section>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div ref={dialog} role="alertdialog" aria-modal="true" aria-labelledby="delete-account-title" aria-describedby="delete-account-description" className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full" onKeyDown={event => {
            if (event.key === 'Escape' && !deleting) setShowDeleteConfirm(false);
            if (event.key === 'Tab') {
              const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
              if (!buttons?.length) { event.preventDefault(); return; }
              if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons[buttons.length - 1].focus(); }
              else if (!event.shiftKey && document.activeElement === buttons[buttons.length - 1]) { event.preventDefault(); buttons[0].focus(); }
            }
          }}>
            <h2 id="delete-account-title" className="text-xl font-bold mb-4">Delete account?</h2>
            <p id="delete-account-description" className="text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete your account and all your library data. This action
              cannot be undone.
            </p>
            {error && <p role="alert" className="text-red-600 mb-4">{error}</p>}
            <div className="flex gap-3 justify-end">
              <Button ref={cancelDelete} variant="secondary" disabled={deleting} onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteAccount} loading={deleting} disabled={deleting || !isOnline}>
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
