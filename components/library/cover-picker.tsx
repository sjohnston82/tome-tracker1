'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CoverOption } from '@/lib/metadata/cover-options'

export function CoverPicker({ book, onSaved }: { book: { id: string; title: string; author: { name: string }; coverUrl: string | null }; onSaved: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState(book.title)
  const [author, setAuthor] = useState(book.author.name)
  const [query, setQuery] = useState({ title: book.title, author: book.author.name, run: 0 })
  const [options, setOptions] = useState<CoverOption[]>([])
  const [selected, setSelected] = useState<CoverOption | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [broken, setBroken] = useState(new Set<string>())
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [online, setOnline] = useState(true)
  const panel = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    update(); window.addEventListener('online', update); window.addEventListener('offline', update)
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update) }
  }, [])
  useEffect(() => {
    if (!open) return
    panel.current?.focus()
    return () => trigger.current?.focus()
  }, [open])
  useEffect(() => {
    if (!open || !online) return
    const controller = new AbortController()
    setLoading(true); setError(''); setSelected(null); setOptions([]); setWarnings([]); setBroken(new Set())
    ;(async () => {
      try {
        const params = new URLSearchParams({ title: query.title, author: query.author })
        const response = await fetch(`/api/books/${book.id}/covers?${params}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message ?? 'Unable to find covers. Please try again.')
        if (!controller.signal.aborted) { setOptions(data.options); setWarnings(data.warnings) }
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Cover search failed.')
      } finally { if (!controller.signal.aborted) setLoading(false) }
    })()
    return () => controller.abort()
  }, [open, online, query, book.id])

  const save = async (coverUrl: string | null) => {
    setSaving(true); setError('')
    try {
      const response = await fetch(`/api/books/${book.id}/covers`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ coverUrl }) })
      if (!response.ok) throw new Error('Unable to save the cover. Please try again.')
      setOpen(false)
      await onSaved()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save cover.') }
    finally { setSaving(false) }
  }
  const failImage = (url: string) => { setBroken(previous => new Set(previous).add(url)); setSelected(previous => previous?.url === url ? null : previous) }

  return <div className="mb-6">
    <Button ref={trigger} variant="secondary" disabled={saving} aria-expanded={open} aria-controls="cover-picker" onClick={() => setOpen(value => !value)}>Choose cover</Button>
    {open && <div id="cover-picker" ref={panel} tabIndex={-1} role="region" aria-label="Choose a book cover" className="border rounded-xl p-4 mt-3 space-y-4" onKeyDown={event => { if (event.key === 'Escape' && !saving) setOpen(false) }}>
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-semibold">Choose a cover</h2><button disabled={saving} onClick={() => setOpen(false)} className="text-blue-600">Keep current cover</button></div>
      <p className="text-sm text-gray-600 dark:text-gray-400">Browse editions from Open Library and Google Books. ISBN matches appear first when available. Search changes here won’t change your book’s title or author.</p>
      {!online && <p role="status">Connect to the internet to search or change covers.</p>}
      <form className="space-y-3" onSubmit={event => { event.preventDefault(); setQuery({ title: title.trim(), author: author.trim(), run: query.run + 1 }) }}>
        <div className="grid sm:grid-cols-2 gap-3"><Input label="Cover search title" required maxLength={500} value={title} onChange={event => setTitle(event.target.value)} /><Input label="Cover search author" maxLength={200} value={author} onChange={event => setAuthor(event.target.value)} /></div>
        <Button size="sm" disabled={!online || loading || saving || !title.trim()} type="submit">Search covers</Button>
      </form>
      {error && <p role="alert" className="text-red-600">{error}</p>}
      {warnings.map(warning => <p key={warning} role="status" className="text-sm text-amber-700">{warning}</p>)}
      {loading ? <p role="status">Finding alternative covers…</p> : <>
        <p className="text-sm">{options.length} cover options. Select a thumbnail to preview it.</p>
        {!options.length && <p>No covers found. Try a shorter title or a different author spelling.</p>}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
          {options.map((option, index) => <button key={option.url} type="button" aria-label={`Preview cover ${index + 1}: ${option.title}`} aria-pressed={selected?.url === option.url} disabled={saving || broken.has(option.url)} onClick={() => setSelected(option)} className={`border rounded-lg p-2 text-left disabled:opacity-50 ${selected?.url === option.url ? 'ring-2 ring-blue-500' : ''}`}>
            {broken.has(option.url) ? <span>Image unavailable</span> : <img src={option.url} alt={`${option.title} — ${option.source}`} loading="lazy" className="h-36 w-full object-contain" onError={() => failImage(option.url)} />}
            <span className="block text-xs mt-2">{option.title}</span><span className="block text-xs text-gray-500">{option.publisher ?? option.source}{option.year ? ` · ${option.year}` : ''}</span>
            {option.exactIsbn && <span className="text-xs text-green-700">Matches your ISBN</span>}
          </button>)}
        </div>
        {selected && <div className="border-t pt-4 space-y-3">
          <img src={selected.url} alt={`Selected cover: ${selected.title}`} className="max-h-80 max-w-full mx-auto object-contain" onError={() => failImage(selected.url)} />
          <p className="text-sm">{selected.title} · {selected.authors.join(', ')} · {selected.source}{selected.isbn ? ` · ISBN ${selected.isbn}` : ''}</p>
          <Button disabled={!online || saving} onClick={() => save(selected.url)}>Use this cover</Button>
        </div>}
      </>}
      {book.coverUrl && <button disabled={!online || saving} className="text-sm text-red-600 underline" onClick={() => save(null)}>Remove cover</button>}
      <p className="text-xs text-gray-500">Your choice, including removing a cover, is preserved during automatic lookup.</p>
    </div>}
  </div>
}
