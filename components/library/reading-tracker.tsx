'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { readingProgress, type ProgressEntry, type ProgressSession } from '@/lib/reading/progress'

const localTime = (date = new Date()) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
const displayTime = (value: string) => new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

export function ReadingTracker({ bookId, status, onChanged }: { bookId: string; status: string; onChanged: () => Promise<void> }) {
  const [session, setSession] = useState<ProgressSession | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [reload, setReload] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [newRead, setNewRead] = useState(false)
  const [editing, setEditing] = useState<ProgressEntry | null>(null)
  const [page, setPage] = useState('')
  const [total, setTotal] = useState('')
  const [baseline, setBaseline] = useState(status === 'READING' ? '' : '0')
  const [time, setTime] = useState(localTime)
  const [note, setNote] = useState('')
  const [finish, setFinish] = useState(false)
  const pending = useRef({ signature: '', id: '' })

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update(); window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    if (!online) { setLoading(false); return }
    const controller = new AbortController()
    setLoading(true); setError('')
    ;(async () => {
      try {
        const response = await fetch(`/api/books/${bookId}/reading`, { cache: 'no-store', signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message ?? 'Unable to load the reading log.')
        if (!controller.signal.aborted) { setSession(data.session); setTotal(data.session?.totalPages?.toString() ?? ''); setBaseline(data.session?.baselinePage?.toString() ?? (status === 'READING' ? '' : '0')) }
      } catch (error) { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Unable to load the reading log.') }
      finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [bookId, reload, online])

  const progress = session ? readingProgress(session) : null
  const save = async (body: Record<string, unknown>) => {
    if (!online || busy) return
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/books/${bookId}/reading`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.message ?? 'Unable to save reading progress.')
      setSession(data.session); setTotal(data.session.totalPages?.toString() ?? ''); setBaseline(String(data.session.baselinePage)); setShowForm(false); setNewRead(false); setEditing(null); setNote(''); pending.current = { signature: '', id: '' }
      setNotice('Reading log saved.')
      await onChanged()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save reading progress. Your entry is still in the form.') }
    finally { setBusy(false) }
  }
  const beginLog = (complete = false, entry?: ProgressEntry) => {
    setPage(String(entry?.page ?? progress?.currentPage ?? 0)); setTime(entry ? localTime(new Date(entry.occurredAt)) : localTime()); setNote(entry?.note ?? ''); setFinish(complete); setEditing(entry ?? null); setShowForm(true)
  }
  const submitLog = () => {
    if (!session) return
    const body = { sessionId: session.id, version: session.version, page: Number(page), occurredAt: new Date(time).toISOString(), note }
    if (editing) { void save({ ...body, action: 'edit', entryId: editing.id }); return }
    const signature = JSON.stringify({ ...body, finish })
    if (pending.current.signature !== signature) pending.current = { signature, id: crypto.randomUUID() }
    void save({ ...body, action: 'log', finish, requestId: pending.current.id })
  }

  if (!online) return <p className="text-sm text-amber-700">Reading logs need a connection. Your cached library remains available.</p>
  if (loading) return <p role="status" className="text-sm text-gray-500">Loading reading progress…</p>
  return <section aria-label="Book reading progress" className="space-y-3">
    {error && <div role="alert" className="text-sm text-red-600">{error} <button type="button" className="underline" disabled={busy} onClick={() => { setShowForm(false); setReload(value => value + 1) }}>Refresh reading log</button></div>}
    {notice && <p role="status" className="text-sm text-green-700">{notice}</p>}
    {session && progress && <>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm"><strong>Page {progress.currentPage}{session.totalPages ? ` of ${session.totalPages}` : ''}</strong>{progress.percent !== null && <span>{progress.percent}%</span>}<span>{progress.pagesLogged} pages logged since your starting point</span></div>
      {session.totalPages && <progress aria-label="Book page progress" className="w-full h-2 accent-blue-600" value={progress.currentPage} max={session.totalPages} />}
      <p className="text-xs text-gray-500">{progress.lastLog ? `Last update: ${displayTime(progress.lastLog.occurredAt)}` : `Starting point: page ${session.baselinePage} · ${displayTime(session.trackedAt)}`}</p>
      {session.finishedAt && <p className="text-sm text-green-700">Finished {displayTime(session.finishedAt)}</p>}
      {!session.finishedAt && !showForm && <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy} onClick={() => beginLog()}>Log progress</Button><Button size="sm" variant="secondary" disabled={busy} onClick={() => beginLog(true)}>Finish book</Button></div>}
      {showForm && <form className="border rounded-lg p-3 space-y-3" onSubmit={event => { event.preventDefault(); submitLog() }}>
        <div className="grid sm:grid-cols-2 gap-3"><Input label="Stopped on page" type="number" required min={session.baselinePage} max={session.totalPages ?? 1000000} value={page} onChange={event => setPage(event.target.value)} /><Input label="Time stopped" type="datetime-local" required value={time} onChange={event => setTime(event.target.value)} /></div>
        <Input label="Reading note (optional)" maxLength={2000} value={note} onChange={event => setNote(event.target.value)} />
        {!editing && <label className="flex gap-2 text-sm items-center"><input type="checkbox" checked={finish} onChange={event => setFinish(event.target.checked)} />I finished this book</label>}
        <div className="flex gap-2"><Button size="sm" disabled={busy} type="submit">{editing ? 'Save correction' : finish ? 'Save completion' : 'Save progress'}</Button><Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => { setShowForm(false); setEditing(null) }}>Cancel</Button></div>
      </form>}
      <details className="text-sm"><summary className="cursor-pointer font-medium">Reading history ({session.logs.length} entries)</summary>
        {!session.logs.length && <p className="text-gray-500 mt-2">Your starting page is a baseline. Log your next stopping point to begin recording pages.</p>}
        <ol className="mt-3 space-y-3 max-h-72 overflow-y-auto">{[...session.logs].reverse().slice(0, 30).map(entry => <li key={entry.id} className="border-b pb-2"><div>Page {entry.page} · {displayTime(entry.occurredAt)}{entry.isCompletion && ' · Finished'}</div>{entry.note && <p className="text-gray-500 break-words">{entry.note}</p>}<div className="flex flex-wrap gap-3 mt-1"><button disabled={busy} className="text-blue-600" onClick={() => beginLog(false, entry)}>Correct entry</button><button disabled={busy} className="text-red-600" onClick={() => save({ action: 'delete', sessionId: session.id, version: session.version, entryId: entry.id })}>{entry.isCompletion ? 'Remove completion and reopen book' : 'Remove entry'}</button></div></li>)}</ol>
        {session.logs.length > 30 && <p>Showing the latest 30 entries. All entries are retained.</p>}
      </details>
      <details className="text-sm"><summary className="cursor-pointer">Page settings</summary><form className="space-y-3 mt-3" onSubmit={event => { event.preventDefault(); void save({ action: 'settings', sessionId: session.id, version: session.version, baselinePage: Number(baseline), totalPages: total ? Number(total) : null }) }}><div className="grid sm:grid-cols-2 gap-3"><Input label="Starting page" type="number" required min={0} max={1000000} value={baseline} onChange={event => setBaseline(event.target.value)} /><Input label="Total pages (optional)" type="number" min={1} max={1000000} value={total} onChange={event => setTotal(event.target.value)} /></div><p className="text-xs text-gray-500">Use the page count of your physical edition. Pages before the starting point are excluded from future page statistics.</p><Button size="sm" disabled={busy} type="submit">Save page settings</Button></form></details>
    </>}
    {(!session || (session.finishedAt && newRead)) && !error && ['UNREAD', 'READING'].includes(status) && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save({ action: 'start', page: Number(baseline), totalPages: total ? Number(total) : null }) }}>
      <p className="text-sm text-gray-600 dark:text-gray-400">{status === 'READING' ? 'Already reading this book? Set your current page as a starting point. Earlier reading will not be estimated.' : 'Start tracking this unread book. Leave the starting page at 0 to record a new read from the beginning.'}</p>
      <div className="grid sm:grid-cols-2 gap-3"><Input label="Starting page" type="number" required min={0} max={1000000} value={baseline} onChange={event => setBaseline(event.target.value)} /><Input label="Total pages (optional)" type="number" min={1} max={1000000} value={total} onChange={event => setTotal(event.target.value)} /></div>
      <Button size="sm" disabled={busy} type="submit">{status === 'READING' ? 'Set starting point' : 'Start reading'}</Button>
    </form>}
    {!session && !error && !['UNREAD', 'READING'].includes(status) && <p className="text-sm text-gray-500">{status === 'READ' ? 'This book is already marked Read. Its historical completion date remains unknown; it is not added to dated reading statistics.' : 'Mark this book Unread or Currently Reading to begin tracking.'}</p>}
    {session?.finishedAt && !newRead && ['UNREAD', 'READING'].includes(status) && <Button size="sm" variant="secondary" disabled={busy} onClick={() => { setBaseline('0'); setNewRead(true) }}>Start a new reading session</Button>}
  </section>
}
