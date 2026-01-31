"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "@/lib/hooks/useTheme";
import { useOfflineLibrary } from "@/lib/hooks/useOfflineLibrary";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { cacheStats, clearLocalCache, syncAndCache } = useOfflineLibrary();

  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSync = async () => {
    setSyncing(true);
    await syncAndCache();
    setSyncing(false);
  };

  const handleClearCache = async () => {
    setClearing(true);
    await clearLocalCache();
    setClearing(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);

    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
      });

      if (response.ok) {
        await clearLocalCache();
        router.push("/login");
      }
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>

      <div className="space-y-6">
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="font-medium text-lg mb-4">Appearance</h2>

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

        <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="font-medium text-lg mb-4">Cache & Sync</h2>

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

          <div className="flex gap-3">
            <Button variant="secondary" onClick={handleSync} loading={syncing}>
              Sync now
            </Button>
            <Button variant="ghost" onClick={handleClearCache} loading={clearing}>
              Clear cache
            </Button>
          </div>
        </section>

        <section className="bg-white dark:bg-gray-800 rounded-lg p-6">
          <h2 className="font-medium text-lg mb-4">Account</h2>

          <div className="space-y-4">
            <Button variant="secondary" onClick={handleLogout}>
              Sign out
            </Button>

            <div className="pt-4 border-t dark:border-gray-700">
              <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Permanently delete your account and all your library data.
              </p>
              <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
                Delete account
              </Button>
            </div>
          </div>
        </section>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Delete account?</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              This will permanently delete your account and all your library data. This action
              cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setShowDeleteConfirm(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleDeleteAccount} loading={deleting}>
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
