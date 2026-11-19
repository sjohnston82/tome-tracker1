'use client'

import { useEffect, useRef, useState } from 'react'
import { coverImageUrl, isBlankCover } from '@/lib/books/cover-image'

export function BookCover({ url, title, thumbnail = false, retry = false }: { url: string | null; title: string; thumbnail?: boolean; retry?: boolean }) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState('')
  const [original, setOriginal] = useState('')
  const [loaded, setLoaded] = useState('')
  const image = useRef<HTMLImageElement>(null)
  const src = url ? coverImageUrl(url, thumbnail && original !== url, attempt) : ''
  const unavailable = !!src && failed === src
  const loading = !!src && !unavailable && loaded !== src
  const fail = () => {
    // Keep previously cached full-size images usable when offline, too.
    if (url && thumbnail && original !== url && src !== coverImageUrl(url, false, attempt)) setOriginal(url)
    else setFailed(src)
  }
  useEffect(() => {
    const cached = image.current
    // Cached images can finish before React attaches its load handler.
    if (src && cached?.complete) {
      if (isBlankCover(cached.naturalWidth, cached.naturalHeight)) fail()
      else setLoaded(src)
    }
  }, [src])
  return <div className={`shrink-0 ${thumbnail ? 'w-10' : 'w-32'}`}>
    {src && !unavailable ? <div className={`relative ${thumbnail ? 'w-10 h-14' : 'w-32 h-48'}`} aria-busy={loading}>
      {loading && <div role="status" aria-label={`Loading cover for ${title}`} className="absolute inset-0 rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse flex items-center justify-center"><span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent motion-safe:animate-spin" /></div>}
      <img ref={image} key={src} src={src} alt={title} loading={thumbnail ? 'lazy' : 'eager'} decoding="async" referrerPolicy="no-referrer" className={`${thumbnail ? 'w-10 h-14' : 'w-32 h-48'} object-contain rounded bg-gray-100 dark:bg-gray-700 transition-opacity motion-reduce:transition-none ${loading ? 'opacity-0' : 'opacity-100'}`} onError={fail} onLoad={event => { if (isBlankCover(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)) fail(); else setLoaded(src) }} />
    </div> : <div role="img" aria-label={unavailable ? `Cover unavailable for ${title}` : `No cover for ${title}`} className={`${thumbnail ? 'w-10 h-14 text-xl' : 'w-32 h-48 text-4xl'} bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center`}>📖</div>}
    {unavailable && retry && <button type="button" className="text-xs text-blue-600 underline mt-2" onClick={() => { setAttempt(value => value + 1); setOriginal(''); setFailed('') }}>Retry image</button>}
  </div>
}
