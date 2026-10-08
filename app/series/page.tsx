'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { checklistStats, ownedEditions, type ChecklistEntry, type ChecklistSeries } from '@/lib/series/checklist'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const statuses = { UNKNOWN: 'Unknown', UNREAD: 'Unread', READING: 'Currently reading', READ: 'Read' }
type ImportReport = { ready: boolean; applied?: boolean; reconciled?: boolean; actualOwned?: number; actualStatuses?: Record<string, number>; summary: { sourceOwned: number; newOwned: number; existingOwned: number; series: number; entries: number; expectedStatuses: Record<string, number> }; issues: { code: string; message: string; title?: string; sourceKey: string; blocking?: boolean }[] }
type PhysicalBook = { id: string; title: string; author: string }
type Candidate = { openLibraryId: string; title: string; authors: string[]; publicationYear: number | null; sourceUrl: string }

async function request<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined, cache: 'no-store' })
  const data = await response.json()
  if (!response.ok && !(response.status === 409 && typeof data.ready === 'boolean')) throw new Error(data.message ?? 'Unable to save changes. Please try again.')
  return data as T
}

export default function SeriesPage() {
  const [series, setSeries] = useState<ChecklistSeries[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [physical, setPhysical] = useState<PhysicalBook[]>([])
  const [newName, setNewName] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newAuthor, setNewAuthor] = useState('')
  const [existingWorkId, setExistingWorkId] = useState('')
  const [newPosition, setNewPosition] = useState('')
  const [newType, setNewType] = useState('MAIN')
  const [editing, setEditing] = useState<ChecklistEntry | null>(null)
  const [edit, setEdit] = useState({ title: '', author: '', year: '', position: '', type: 'MAIN', confirmed: false })
  const [linkBook, setLinkBook] = useState('')
  const [lookup, setLookup] = useState<{ message: string; candidates: Candidate[] } | null>(null)
  const [manifest, setManifest] = useState<unknown>(null)
  const [report, setReport] = useState<ImportReport | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [online, setOnline] = useState(true)

  const reload = useCallback(async () => {
    const data = await request<{ series: ChecklistSeries[] }>('/api/series')
    setSeries(data.series)
    setSelected(current => data.series.some(s => s.id === current) ? current : data.series[0]?.id ?? null)
  }, [])
  useEffect(() => {
    let active = true
    const updateOnline = () => setOnline(navigator.onLine)
    updateOnline()
    window.addEventListener('online', updateOnline)
    window.addEventListener('offline', updateOnline)
    Promise.all([reload(), request<{ authors: { name: string; books: { id: string; title: string }[] }[] }>('/api/library/sync').then(data => { if (active) setPhysical(data.authors.flatMap(a => a.books.map(b => ({ ...b, author: a.name })))) })])
      .catch(e => { if (active) setError(e.message) }).finally(() => { if (active) setLoading(false) })
    request<{ import: { report: ImportReport } | null }>('/api/collection-import').then(data => { if (active && data.import) setReport(data.import.report) }).catch(() => {})
    return () => { active = false; window.removeEventListener('online', updateOnline); window.removeEventListener('offline', updateOnline) }
  }, [reload])

  const perform = async (operation: () => Promise<unknown>, message: string) => {
    if (busy || !online) return
    setBusy(true); setError(''); setNotice('')
    try { await operation(); await reload(); setNotice(message) } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save changes') } finally { setBusy(false) }
  }
  const current = series.find(s => s.id === selected)
  const visibleSeries = series.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || s.entries.some(e => e.work.title.toLowerCase().includes(search.toLowerCase())))
  const stats = current ? checklistStats(current) : null
  const entries = current?.entries.filter(entry => {
    const editions = ownedEditions(entry)
    return filter === 'all' || (filter === 'missing' && !editions.length) || (filter === 'owned' && !!editions.length) || (filter === 'unread' && editions.some(b => b.readingStatus === 'UNREAD')) || (filter === 'reading' && editions.some(b => b.readingStatus === 'READING')) || (filter === 'review' && !entry.isConfirmed)
  }) ?? []
  const works = [...new Map(series.flatMap(s => s.entries.map(e => [e.work.id, e.work] as const))).values()]
  const startEdit = (entry: ChecklistEntry) => {
    setEditing(entry); setLookup(null); setLinkBook('')
    setEdit({ title: entry.work.title, author: entry.work.authorName, year: entry.work.publicationYear?.toString() ?? '', position: entry.position?.toString() ?? '', type: entry.entryType, confirmed: entry.isConfirmed })
  }

  return <div className="max-w-7xl mx-auto px-4 py-8">
    <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
      <div><p className="text-sm text-blue-600 font-medium">TOME TRACKER / SERIES</p><h1 className="text-3xl font-bold mt-1">The whole story</h1><p className="text-gray-600 dark:text-gray-400 mt-2">Your shelves, your reading progress, and the books still to find.</p></div>
      <Button variant="secondary" onClick={() => setShowImport(v => !v)}>Import collection</Button>
    </div>
    {!online && <p role="status" className="mb-4 text-amber-700">You are offline. Series changes need an internet connection; your cached library is available in Library.</p>}
    {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 text-red-700 p-3">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg bg-green-50 text-green-800 p-3">{notice}</p>}
    {showImport && <section className="border rounded-xl p-5 mb-6 space-y-4 bg-white dark:bg-gray-900">
      <h2 className="text-lg font-semibold">Import your verified collection</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">Upload the collection manifest generated from your Excel master and Word checklists. Preview compares it with your library before any changes.</p>
      <label className="block text-sm font-medium">Collection manifest <input className="block mt-2" type="file" accept=".json,application/json" disabled={busy || !online} onChange={async event => {
        const file = event.target.files?.[0]; setManifest(null); setReport(null)
        if (!file) return
        setBusy(true); setError('')
        try {
          if (file.size > 5_000_000) throw new Error('This collection file is too large.')
          const data: unknown = JSON.parse(await file.text())
          const preview = await request<ImportReport>('/api/collection-import', 'POST', { mode: 'preview', manifest: data })
          setManifest(data); setReport(preview)
        } catch (e) { setError(e instanceof Error ? e.message : 'Unable to preview the collection') } finally { setBusy(false) }
      }} /></label>
      {report && <>
        <p className="font-medium">{report.summary.sourceOwned} source books · {report.summary.series} series · {report.summary.entries} checklist entries</p>
        <p className="text-sm">{report.summary.newOwned} books to add · {report.summary.existingOwned} existing editions to reuse</p>
        <p className="text-sm">Source reading statuses: {Object.entries(report.summary.expectedStatuses).map(([key, count]) => `${count} ${statuses[key as keyof typeof statuses]}`).join(' · ')}</p>
        {report.applied && <p role="status">Imported {report.actualOwned} physical books. {report.reconciled ? 'Reading counts match the source.' : 'Reading counts differ because existing library corrections were preserved; review the differences below.'}</p>}
        {report.issues.length > 0 && <details open={report.issues.some(i => i.blocking)}><summary className="cursor-pointer font-medium">{report.issues.length} items for review</summary><ul className="mt-3 space-y-2 text-sm max-h-64 overflow-y-auto">{report.issues.map((issue, index) => <li key={`${issue.sourceKey}-${index}`} className={issue.blocking ? 'text-red-700' : ''}>{issue.title && <strong>{issue.title}: </strong>}{issue.message}</li>)}</ul></details>}
        {manifest && !report.applied && <Button disabled={busy || !online || !report.ready} onClick={() => perform(async () => setReport(await request<ImportReport>('/api/collection-import', 'POST', { mode: 'apply', manifest })), 'Collection imported. Existing metadata was preserved.')}>Import this collection</Button>}
      </>}
    </section>}
    {loading ? <p role="status" className="py-12 text-center">Loading your series…</p> : <div className="grid lg:grid-cols-[280px_1fr] gap-6">
      <aside className="space-y-4">
        <Input aria-label="Search series or titles" placeholder="Search series or titles" value={search} onChange={e => setSearch(e.target.value)} />
        <nav aria-label="Series checklists" className="space-y-2 lg:max-h-[65vh] lg:overflow-y-auto">{visibleSeries.map(s => {
          const summary = checklistStats(s)
          return <button key={s.id} onClick={() => { setSelected(s.id); setFilter('all'); setEditing(null) }} aria-current={selected === s.id ? 'page' : undefined} className={`text-left w-full border rounded-xl p-4 transition-colors ${selected === s.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : 'bg-white dark:bg-gray-900 hover:border-blue-300'}`}>
            <span className="font-semibold block">{s.name}</span><span className="text-xs text-gray-600 dark:text-gray-400 block mt-1">{summary.owned} of {summary.total} owned · {summary.missing} missing</span>
            <progress aria-label={`${s.name} ownership`} className="w-full h-1.5 mt-3 accent-blue-600" value={summary.owned} max={summary.total || 1} />
          </button>
        })}</nav>
        {!visibleSeries.length && <p className="text-sm text-gray-500">No series found.</p>}
        <form className="border-t pt-4 space-y-2" onSubmit={e => { e.preventDefault(); perform(async () => { const result = await request<{ series: ChecklistSeries }>('/api/series', 'POST', { name: newName }); setSelected(result.series.id); setNewName('') }, 'Series created.') }}>
          <Input label="New series" required maxLength={250} value={newName} onChange={e => setNewName(e.target.value)} />
          <Button size="sm" disabled={busy || !online || !newName.trim()} type="submit">Create series</Button>
        </form>
      </aside>
      <section className="min-w-0">
        {current && stats ? <>
          <div className="border rounded-2xl p-6 mb-5 bg-white dark:bg-gray-900">
            <h2 className="text-2xl font-bold">{current.name}</h2>{current.description && <p className="mt-2 text-gray-600 dark:text-gray-400">{current.description}</p>}
            <div className="grid grid-cols-3 gap-4 my-5">{[['Owned', stats.owned], ['Missing', stats.missing], ['Read', stats.read]].map(([label, count]) => <div key={label}><span className="block text-3xl font-semibold">{count}</span><span className="text-sm text-gray-500">{label}</span></div>)}</div>
            <p className="text-xs text-gray-500">{stats.total} entries recorded. Checklist completeness is unverified; unconfirmed positions need review. Missing publication years remain unknown.</p>
          </div>
          <label className="text-sm font-medium">Show <select className="border rounded-lg px-3 py-2 ml-2 bg-white dark:bg-gray-900" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All entries</option><option value="owned">Owned</option><option value="missing">Missing</option><option value="unread">Unread</option><option value="reading">Currently reading</option><option value="review">Order to review</option></select></label>
          <ol className="mt-4 space-y-3">{entries.map(entry => {
            const editions = ownedEditions(entry)
            const year = entry.work.publicationYear
            return <li key={entry.id} className="border rounded-xl p-4 sm:p-5 bg-white dark:bg-gray-900">
              <div className="flex items-start gap-4"><span className="min-w-10 text-center rounded-lg bg-gray-100 dark:bg-gray-800 p-2 text-sm font-semibold">{entry.position ?? '?'}</span>
                <div className="flex-1 min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-lg">{entry.work.title}</h3><span className={`text-xs rounded-full px-2 py-1 ${editions.length ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>{editions.length ? 'Owned' : 'Missing'}</span>{year === new Date().getFullYear() && <span className="text-xs text-blue-600">Published this year</span>}{year !== null && year > new Date().getFullYear() && <span className="text-xs text-amber-700">Future date · verify release</span>}</div>
                  <p className="text-sm text-gray-500 mt-1">{entry.work.authorName} · {year ?? 'Year unknown'} · {entry.entryType.toLowerCase()}{!entry.isConfirmed && ' · Order unconfirmed'}</p>
                  <div className="mt-3 space-y-2">{editions.map(book => <div key={book.id} className="flex flex-wrap items-center gap-3 text-sm"><Link className="text-blue-600 hover:underline" href={`/library/book/${book.id}`}>{book.title}</Link><select aria-label={`Reading status for ${book.title}`} className="border rounded-lg px-2 py-1 bg-white dark:bg-gray-900" disabled={busy || !online} value={book.readingStatus} onChange={e => perform(() => request(`/api/books/${book.id}`, 'PATCH', { readingStatus: e.target.value }), 'Reading status updated.')}>{Object.entries(statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>)}</div>
                </div><button className="text-blue-600 text-sm hover:underline shrink-0" disabled={busy || !online} onClick={() => startEdit(entry)}>Edit</button>
              </div>
              {editing?.id === entry.id && <form className="border-t mt-4 pt-4 space-y-3" onSubmit={e => {
                e.preventDefault()
                perform(async () => {
                  await request(`/api/works/${entry.work.id}`, 'PATCH', { title: edit.title, authorName: edit.author, publicationYear: edit.year ? Number(edit.year) : null })
                  await request(`/api/series/${current.id}/entries/${entry.id}`, 'PATCH', { position: edit.position ? Number(edit.position) : null, entryType: edit.type, isConfirmed: edit.confirmed })
                  setEditing(null)
                }, 'Corrections saved.')
              }}>
                <div className="grid sm:grid-cols-2 gap-3"><Input label="Work title" required value={edit.title} onChange={e => setEdit(v => ({ ...v, title: e.target.value }))} /><Input label="Author" required value={edit.author} onChange={e => setEdit(v => ({ ...v, author: e.target.value }))} /><Input label="Original publication year" type="number" min="1" max="9999" value={edit.year} onChange={e => setEdit(v => ({ ...v, year: e.target.value }))} /><Input label="Series position" type="number" min="0" max="99999.999" step="0.001" value={edit.position} onChange={e => setEdit(v => ({ ...v, position: e.target.value }))} /></div>
                <label className="block text-sm">Entry type <select className="border rounded p-2 ml-2 bg-white dark:bg-gray-900" value={edit.type} onChange={e => setEdit(v => ({ ...v, type: e.target.value }))}>{['MAIN', 'PREQUEL', 'NOVELLA', 'COMPANION', 'OTHER'].map(type => <option key={type}>{type}</option>)}</select></label>
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={edit.confirmed} onChange={e => setEdit(v => ({ ...v, confirmed: e.target.checked }))} />I have verified this series position and entry type</label>
                <div className="flex flex-wrap gap-2"><Button size="sm" disabled={busy || !online} type="submit">Save corrections</Button><Button size="sm" variant="secondary" type="button" onClick={() => setEditing(null)}>Cancel</Button><Button size="sm" variant="secondary" type="button" disabled={busy || !online} onClick={async () => { setBusy(true); setError(''); try { setLookup(await request(`/api/works/${entry.work.id}/metadata`)) } catch (e) { setError(e instanceof Error ? e.message : 'Lookup failed') } finally { setBusy(false) } }}>Look up metadata</Button></div>
                {lookup && <div className="text-sm space-y-2"><p>{lookup.message}</p>{lookup.candidates.map(candidate => <div key={candidate.openLibraryId} className="border rounded p-3"><a href={candidate.sourceUrl} target="_blank" rel="noreferrer" className="text-blue-600">{candidate.title}</a> · {candidate.authors.join(', ')} · {candidate.publicationYear ?? 'Year unknown'}<button type="button" className="block text-blue-600 mt-1" onClick={() => setEdit(v => ({ ...v, title: candidate.title, author: candidate.authors[0] ?? v.author, year: candidate.publicationYear?.toString() ?? v.year }))}>Use these values in the form</button></div>)}</div>}
                <div className="border-t pt-3"><label className="text-sm block">Link a physical book you own <select aria-label="Owned edition to link" className="block w-full border rounded p-2 mt-2 bg-white dark:bg-gray-900" value={linkBook} onChange={e => setLinkBook(e.target.value)}><option value="">Select an edition…</option>{physical.map(book => <option key={book.id} value={book.id}>{book.title} — {book.author}</option>)}</select></label><Button className="mt-2" size="sm" type="button" disabled={busy || !online || !linkBook} onClick={() => perform(() => request(`/api/works/${entry.work.id}/editions`, 'POST', { bookId: linkBook }), 'Edition linked. Physical book count is unchanged.')}>Link edition</Button></div>
              </form>}
            </li>
          })}</ol>
          {!entries.length && <p className="text-gray-500 py-8">No entries match this filter.</p>}
          <form className="border rounded-xl p-5 mt-6 space-y-3" onSubmit={e => { e.preventDefault(); perform(async () => {
            let workId = existingWorkId
            if (!workId) workId = (await request<{ work: { id: string } }>('/api/works', 'POST', { title: newTitle, authorName: newAuthor })).work.id
            await request(`/api/series/${current.id}/entries`, 'POST', { workId, position: newPosition ? Number(newPosition) : null, entryType: newType, isConfirmed: false })
            setNewTitle(''); setNewAuthor(''); setExistingWorkId(''); setNewPosition('')
          }, 'Checklist entry added. Ownership has not changed.') }}>
            <h3 className="font-semibold">Add a checklist entry</h3><p className="text-sm text-gray-500">A work can belong to several series. Link a physical edition separately when you own it.</p>
            <label className="block text-sm">Existing work <select className="block w-full border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={existingWorkId} onChange={e => setExistingWorkId(e.target.value)}><option value="">Create a new work…</option>{works.map(work => <option key={work.id} value={work.id}>{work.title} — {work.authorName}</option>)}</select></label>
            {!existingWorkId && <div className="grid sm:grid-cols-2 gap-3"><Input label="Title" required value={newTitle} onChange={e => setNewTitle(e.target.value)} /><Input label="Author" required value={newAuthor} onChange={e => setNewAuthor(e.target.value)} /></div>}
            <div className="flex flex-wrap gap-3"><Input label="Position (optional)" type="number" min="0" max="99999.999" step="0.001" value={newPosition} onChange={e => setNewPosition(e.target.value)} /><label className="text-sm">Entry type <select className="block border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={newType} onChange={e => setNewType(e.target.value)}>{['MAIN', 'PREQUEL', 'NOVELLA', 'COMPANION', 'OTHER'].map(type => <option key={type}>{type}</option>)}</select></label></div>
            <Button size="sm" type="submit" disabled={busy || !online}>Add entry</Button>
          </form>
        </> : <div className="border border-dashed rounded-2xl p-12 text-center"><h2 className="text-xl font-semibold">Start a series checklist</h2><p className="text-gray-500 mt-2">Import your collection or create a series to see owned books and missing entries together.</p></div>}
      </section>
    </div>}
  </div>
}
