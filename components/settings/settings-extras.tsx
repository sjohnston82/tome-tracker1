"use client";
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePreferences, type Preferences } from '@/lib/preferences';
import { useOfflineLibrary } from '@/lib/hooks/useOfflineLibrary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { downloadCovers } from '@/lib/offline/covers';
import { version } from '@/package.json';
const panel = 'bg-white dark:bg-gray-800 rounded-lg p-6 space-y-4';
const field = 'block w-full border rounded-lg p-2 bg-white dark:bg-gray-900 mt-1';
function useAction() {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [message, setMessage] = useState('');
  const lock = useRef(false);
  const run = async (action: () => Promise<void>) => { if (lock.current) return; lock.current = true; setBusy(true); setError(''); setMessage(''); try { await action(); } catch (error) { setError(error instanceof Error ? error.message : 'Unable to complete this action.'); } finally { lock.current = false; setBusy(false); } };
  return { busy, run, setMessage, feedback: <>{error && <p role="alert" className="text-red-600">{error}</p>}{message && <p role="status" className="text-green-700 dark:text-green-300">{message}</p>}</> };
}
async function jsonResponse(response: Response) { const data = await response.json(); if (!response.ok) throw new Error(data.message ?? 'Request failed. Try again.'); return data; }
function saveFile(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
export function PreferenceSettings() {
  const { preferences, update, ready, error } = usePreferences();
  const toggle = (key: keyof Preferences, label: string) => <label className="flex gap-3 items-center"><input type="checkbox" disabled={!ready} checked={!!preferences[key]} onChange={event => update({ [key]: event.target.checked })} />{label}</label>;
  return <>
    <section className={panel}><h2 className="font-medium text-lg">Library defaults</h2><p className="text-sm text-gray-500">These preferences apply to your account in this browser. Authors remain alphabetical by surname.</p>{error && <p role="alert">{error}</p>}
      <label className="block">Book order within each author<select className={field} disabled={!ready} value={preferences.bookSort} onChange={event => update({ bookSort: event.target.value as Preferences['bookSort'] })}><option value="series">Series order, then title</option><option value="title">Title</option><option value="year">Publication year, oldest first</option></select></label>
      {toggle('groupBySeries', 'Show series details by default')}{toggle('expandAuthors', 'Start with author sections expanded')}{toggle('autoCovers', 'Automatically find missing covers')}
      <p className="text-sm text-gray-500">Automatic lookup fills missing covers and preserves your selected covers. You can still search manually when it is off. Covers supplied by a selected edition are kept.</p>
    </section>
    <section className={panel}><h2 className="font-medium text-lg">Reading preferences</h2>{toggle('showCurrentlyReading', 'Show Currently Reading at the top of the library')}
      <label className="block">Default progress entry<select className={field} disabled={!ready} value={preferences.progressUnit} onChange={event => update({ progressUnit: event.target.value as Preferences['progressUnit'] })}><option value="pages">Pages</option><option value="percent">Percentage</option></select></label><p className="text-sm text-gray-500">Percentage needs a saved page count and is converted to the nearest page. Existing logs stay unchanged.</p>
    </section>
    <section className={panel}><h2 className="font-medium text-lg">Accessibility</h2><label className="block">Text size<select className={field} disabled={!ready} value={preferences.textSize} onChange={event => update({ textSize: event.target.value as Preferences['textSize'] })}><option value="standard">Standard</option><option value="large">Large</option><option value="larger">Larger</option></select></label>{toggle('reduceMotion', 'Reduce animations and smooth scrolling')}<p className="text-sm text-gray-500">Your device’s reduced-motion setting is also respected. Browser zoom remains available.</p></section>
  </>;
}
export function BackupSettings() {
  const { isOnline, syncAndCache } = useOfflineLibrary(); const { busy, run, feedback, setMessage } = useAction();
  const [backup, setBackup] = useState<string | null>(null), [summary, setSummary] = useState<{ books: number; series: number; works: number; readingLogs: number } | null>(null);
  const file = useRef<HTMLInputElement>(null); const router = useRouter();
  const download = (format: 'json' | 'csv') => run(async () => { const response = await fetch(`/api/account/backup?format=${format}`, { cache: 'no-store' }); if (!response.ok) { await jsonResponse(response); return; } saveFile(await response.blob(), `tome-tracker-${new Date().toISOString().slice(0, 10)}.${format}`); setMessage(format === 'json' ? 'Backup downloaded. Keep it somewhere private; it includes your reading notes.' : 'Library CSV downloaded.'); });
  return <section className={panel}><h2 className="font-medium text-lg">Export & backup</h2><p className="text-sm text-gray-500">A JSON backup includes owned books, missing series works, reading history, saved metadata and import review records. It excludes passwords and account credentials. CSV contains your owned-book list for spreadsheets; it is not a full backup.</p>{feedback}
    <div className="flex flex-wrap gap-3"><Button disabled={busy || !isOnline} onClick={() => download('json')}>Download backup</Button><Button variant="secondary" disabled={busy || !isOnline} onClick={() => download('csv')}>Export library CSV</Button></div>
    <details><summary className="cursor-pointer font-medium">Restore a backup</summary><div className="space-y-3 mt-3"><p className="text-sm">Restore works only with an empty library. It never replaces or merges existing records. Choose a Tome Tracker backup, review its contents, then confirm.</p><label className="block">Backup JSON<input ref={file} className="block mt-2" type="file" accept=".json,application/json" disabled={busy || !isOnline} onChange={event => { const selected = event.target.files?.[0]; setBackup(null); setSummary(null); if (!selected) return; void run(async () => { if (selected.size > 20 * 1024 * 1024) throw new Error('Choose a backup smaller than 20 MB.'); const text = await selected.text(); const data = await jsonResponse(await fetch('/api/account/backup?preview=1', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: text })); setBackup(text); setSummary(data.summary); }); }} /></label>
    {summary && <div className="space-y-3"><p>{summary.books} owned books · {summary.works} catalog works · {summary.series} series · {summary.readingLogs} reading entries</p><Button disabled={busy || !isOnline} onClick={() => run(async () => { await jsonResponse(await fetch('/api/account/backup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Confirm-Restore': 'yes' }, body: backup })); setBackup(null); setSummary(null); if (file.current) file.current.value = ''; const synced = await syncAndCache(); setMessage(synced ? 'Backup restored and offline library refreshed.' : 'Backup restored. Use Sync now to refresh your offline library.'); router.refresh(); })}>Confirm restore into empty library</Button><Button variant="ghost" disabled={busy} onClick={() => { setBackup(null); setSummary(null); if (file.current) file.current.value = ''; }}>Cancel restore</Button></div>}</div></details>
    {!isOnline && <p>Export and restore require an internet connection.</p>}
  </section>;
}
export function SecuritySettings() {
  const { isOnline } = useOfflineLibrary(); const { busy, run, feedback, setMessage } = useAction(); const router = useRouter();
  const [email, setEmail] = useState(''), [newEmail, setNewEmail] = useState(''), [password, setPassword] = useState(''), [newPassword, setNewPassword] = useState(''), [confirm, setConfirm] = useState(''), [loadError, setLoadError] = useState('');
  useEffect(() => { const controller = new AbortController(); if (isOnline) void fetch('/api/account', { cache: 'no-store', signal: controller.signal }).then(jsonResponse).then(data => { setEmail(data.user.email); setLoadError(''); }).catch(() => { if (!controller.signal.aborted) setLoadError('Account details could not be loaded. You can still submit a change.'); }); return () => controller.abort(); }, [isOnline]);
  return <section className={panel}><h2 className="font-medium text-lg">Email & password</h2>{email && <p>Signed in as {email}</p>}{loadError && <p role="status">{loadError}</p>}{feedback}<form className="space-y-3" onSubmit={event => { event.preventDefault(); void run(async () => { if (!newEmail.trim() && !newPassword) throw new Error('Enter a new email address or password.'); if (newPassword !== confirm) throw new Error('New passwords do not match.'); const data = await jsonResponse(await fetch('/api/account/security', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: password, ...(newEmail.trim() ? { email: newEmail.trim() } : {}), ...(newPassword ? { newPassword } : {}) }) })); setEmail(data.email); setNewEmail(''); setPassword(''); setNewPassword(''); setConfirm(''); setMessage('Account details updated.'); router.refresh(); }); }}>
    <Input label="New email (optional)" type="email" autoComplete="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} disabled={busy || !isOnline} />
    <Input label="New password (optional)" type="password" autoComplete="new-password" minLength={12} maxLength={72} value={newPassword} onChange={event => setNewPassword(event.target.value)} disabled={busy || !isOnline} /><p className="text-sm text-gray-500">Use 12–72 characters, including a number and a symbol.</p>
    <Input label="Confirm new password" type="password" autoComplete="new-password" value={confirm} onChange={event => setConfirm(event.target.value)} disabled={busy || !isOnline} required={!!newPassword} />
    <Input label="Current password" type="password" autoComplete="current-password" required value={password} onChange={event => setPassword(event.target.value)} disabled={busy || !isOnline} />
    <Button type="submit" disabled={busy || !isOnline} loading={busy}>Save account changes</Button>
  </form></section>;
}
export function OfflineCoverSettings() {
  const { isOnline } = useOfflineLibrary(); const { busy, run, feedback, setMessage } = useAction();
  return <section className={panel}><h2 className="font-medium text-lg">Offline covers</h2><p className="text-sm text-gray-500">Download existing Open Library and Google Books covers in advance. Failed or unsupported images are reported. Downloaded images count toward this browser’s storage and are removed by Clear library cache.</p>{feedback}<Button variant="secondary" disabled={busy || !isOnline} loading={busy} onClick={() => run(async () => { const data = await jsonResponse(await fetch('/api/library/sync', { cache: 'no-store' })); const urls: string[] = data.authors.flatMap((a: { books: { coverUrl: string | null }[] }) => a.books.map(b => b.coverUrl).filter(Boolean)); const result = await downloadCovers(urls, (done, total) => setMessage(`Downloading covers: ${done} of ${total} images checked.`)); setMessage(`${result.downloaded} cover images available offline · ${result.failed} failed · ${result.unsupported} unsupported cover URLs.`); })}>Download covers for offline use</Button></section>;
}
export function DiagnosticsSettings() {
  const { isOnline, cacheStats } = useOfflineLibrary(); const { run, feedback, setMessage } = useAction(); const [details, setDetails] = useState('');
  const diagnostics = () => JSON.stringify({ app: 'Tome Tracker', version, connection: isOnline ? 'online' : 'offline', lastSync: cacheStats?.lastSync ?? null, cachedBooks: cacheStats?.bookCount ?? 0, cachedAuthors: cacheStats?.authorCount ?? 0, serviceWorkerSupported: 'serviceWorker' in navigator, serviceWorkerActive: !!navigator.serviceWorker?.controller, offlineStorageSupported: typeof indexedDB !== 'undefined', coverStorageSupported: typeof caches !== 'undefined' }, null, 2);
  return <section className={panel}><h2 className="font-medium text-lg">About & diagnostics</h2><p>Tome Tracker {version} · {isOnline ? 'Online' : 'Offline'}</p><p className="text-sm text-gray-500">Last library sync: {cacheStats?.lastSync ? new Date(cacheStats.lastSync).toLocaleString() : 'Not yet synced'}. Troubleshooting details exclude your email, book titles, reading notes and credentials.</p>{feedback}<Button variant="secondary" onClick={() => run(async () => { const value = diagnostics(); setDetails(value); try { await navigator.clipboard.writeText(value); setMessage('Troubleshooting details copied.'); } catch { setMessage('Clipboard unavailable. Copy the details below.'); } })}>Copy troubleshooting details</Button>{details && <textarea aria-label="Troubleshooting details" readOnly rows={12} value={details} className={`${field} font-mono text-sm`} />}</section>;
}
