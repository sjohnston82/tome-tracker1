"use client";
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useCacheOwner } from '@/lib/offline/owner';
export const defaultPreferences = { bookSort: 'series', groupBySeries: false, expandAuthors: false, autoCovers: true, showCurrentlyReading: true, progressUnit: 'pages', textSize: 'standard', reduceMotion: false } as const;
export type Preferences = { bookSort: 'title' | 'series' | 'year'; groupBySeries: boolean; expandAuthors: boolean; autoCovers: boolean; showCurrentlyReading: boolean; progressUnit: 'pages' | 'percent'; textSize: 'standard' | 'large' | 'larger'; reduceMotion: boolean };
export function parsePreferences(value: unknown): Preferences {
  const result: Preferences = { ...defaultPreferences };
  if (!value || typeof value !== 'object') return result;
  const input = value as Record<string, unknown>;
  for (const key of ['groupBySeries', 'expandAuthors', 'autoCovers', 'showCurrentlyReading', 'reduceMotion'] as const) if (typeof input[key] === 'boolean') result[key] = input[key];
  if (['title', 'series', 'year'].includes(String(input.bookSort))) result.bookSort = input.bookSort as Preferences['bookSort'];
  if (['pages', 'percent'].includes(String(input.progressUnit))) result.progressUnit = input.progressUnit as Preferences['progressUnit'];
  if (['standard', 'large', 'larger'].includes(String(input.textSize))) result.textSize = input.textSize as Preferences['textSize'];
  return result;
}
const Context = createContext({ preferences: { ...defaultPreferences } as Preferences, ready: false, error: '', update: (_value: Partial<Preferences>) => {} });
export function PreferencesProvider({ children }: { children: ReactNode }) {
  const owner = useCacheOwner();
  const key = `tome-preferences:${owner ?? 'guest'}`;
  const [state, setState] = useState<{ key: string; value: Preferences }>({ key: '', value: { ...defaultPreferences } });
  const [error, setError] = useState('');
  const ready = state.key === key;
  const preferences = ready ? state.value : { ...defaultPreferences };
  useEffect(() => {
    const load = () => { let value: Preferences = { ...defaultPreferences }; try { value = parsePreferences(JSON.parse(localStorage.getItem(key) ?? '{}')); setError(''); } catch { setError('Preferences could not be loaded. Changes apply for this visit.'); } setState({ key, value }); };
    load(); const onStorage = (event: StorageEvent) => { if (event.key === key || event.key === null) load(); };
    window.addEventListener('storage', onStorage); return () => window.removeEventListener('storage', onStorage);
  }, [key]);
  useEffect(() => { document.documentElement.dataset.textSize = preferences.textSize; document.documentElement.classList.toggle('reduce-motion', preferences.reduceMotion); }, [preferences.textSize, preferences.reduceMotion]);
  const update = (value: Partial<Preferences>) => { const next = parsePreferences({ ...preferences, ...value }); setState({ key, value: next }); try { localStorage.setItem(key, JSON.stringify(next)); setError(''); } catch { setError('Preferences could not be saved. Changes apply for this visit.'); } };
  return <Context.Provider value={{ preferences, ready, error, update }}>{children}</Context.Provider>;
}
export const usePreferences = () => useContext(Context);
