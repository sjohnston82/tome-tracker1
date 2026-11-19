'use client'

import { useEffect, useRef, useState } from 'react'

export function CoverEnrichment({ authors, onUpdated }: { authors: { books: { id: string; coverUrl?: string | null }[] }[]; onUpdated: () => Promise<void> }) {
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  const attempted = useRef(new Set<string>())
  const refresh = useRef(onUpdated)
  refresh.current = onUpdated
  // Covers changing during a pass must not restart or cancel that pass.
  const signature = authors.flatMap(a => a.books.map(b => b.id)).sort().join(',')
  const missing = authors.some(a => a.books.some(b => !b.coverUrl))
  useEffect(() => {
    if (!signature || !missing || !navigator.onLine || attempted.current.has(`${signature}:${retry}`)) return
    attempted.current.add(`${signature}:${retry}`)
    let stopped = false
    const controller = new AbortController()
    ;(async () => {
      let after: string | undefined
      let updated = 0
      let processed = 0
      try {
        do {
          const response = await fetch('/api/enrichment/covers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ after }), signal: controller.signal })
          if (!response.ok) throw new Error('Cover lookup paused. You can retry below.')
          const data = await response.json()
          if (stopped) return
          updated += data.updated; processed += data.processed
          setMessage(`Finding covers… ${processed} books checked, ${updated} covers found.`)
          if (data.updated) await refresh.current()
          after = data.next ?? undefined
        } while (after && !stopped)
        if (!stopped) setMessage(`Cover search complete: ${updated} covers found. Unmatched books keep their placeholder; covers may differ from your physical edition.`)
      } catch { if (!stopped) setMessage('Cover lookup paused. You can retry below.') }
    })()
    return () => { stopped = true; controller.abort(); attempted.current.delete(`${signature}:${retry}`) }
  }, [signature, retry]) // missing is sampled only at the start of each collection pass
  return <div className="max-w-4xl mx-auto px-4 pt-3 text-sm text-gray-600 dark:text-gray-400"><p role="status">{message}</p>{missing && <button className="text-blue-600 underline" onClick={() => { setMessage('Finding missing covers…'); setRetry(v => v + 1) }}>Retry missing covers</button>}</div>
}
