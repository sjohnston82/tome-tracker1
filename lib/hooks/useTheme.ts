"use client";

import { createContext, createElement, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { validTheme, type Theme } from '@/lib/theme';

const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void; storageError: string | null } | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("system");
  const [storageError, setStorageError] = useState<string | null>(null);
  const preference = useRef<Theme>('system');

  useEffect(() => {
    let initial: Theme = 'system';
    try { initial = validTheme(localStorage.getItem('theme')); }
    catch { setStorageError('This browser cannot save appearance preferences. Changes apply for this visit.'); }
    preference.current = initial;
    setThemeState(initial);
    applyTheme(initial);
    const media = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const handleChange = () => { if (preference.current === 'system') applyTheme('system'); };
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== 'theme' && event.key !== null) return;
      const next = validTheme(event.newValue); preference.current = next; setThemeState(next); applyTheme(next);
    };
    media?.addEventListener('change', handleChange);
    window.addEventListener('storage', handleStorage);
    return () => { media?.removeEventListener('change', handleChange); window.removeEventListener('storage', handleStorage); };
  }, []);

  const setTheme = (newTheme: Theme) => {
    const next = validTheme(newTheme);
    preference.current = next; setThemeState(next); applyTheme(next);
    try { localStorage.setItem('theme', next); setStorageError(null); }
    catch { setStorageError('The theme changed, but this browser could not save it for your next visit.'); }
  };

  return createElement(ThemeContext.Provider, { value: { theme, setTheme, storageError } }, children);
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme requires ThemeProvider');
  return context;
}

function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "system") {
    const prefersDark = typeof window.matchMedia === 'function' && window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    root.style.colorScheme = prefersDark ? 'dark' : 'light';
  } else {
    root.classList.toggle("dark", theme === "dark");
    root.style.colorScheme = theme;
  }
}
