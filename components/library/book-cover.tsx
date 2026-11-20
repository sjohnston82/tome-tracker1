'use client'

import { useEffect, useRef, useState } from 'react'
import { OFFLINE_COVERS, coverCacheKey } from '@/lib/offline/covers'
import { coverImageUrl, isBlankCover } from '@/lib/books/cover-image'

export function BookCover({ url, title, thumbnail = false, retry = false, shelf = false }: { url: string | null; title: string; thumbnail?: boolean; retry?: boolean; shelf?: boolean }) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState('')
  const [original, setOriginal] = useState('')
  const [loaded, setLoaded] = useState('')
  const image = useRef<HTMLImageElement>(null)
  const src = url ? coverImageUrl(url, (thumbnail || shelf) && original !== url, attempt) : ''
  const [downloaded, setDownloaded] = useState({ src: '', blob: '' })
  const displaySrc = downloaded.src === src ? downloaded.blob : src
  useEffect(() => {
    let active = true, objectURL = '';
    if (src && typeof caches !== 'undefined') void caches.open(OFFLINE_COVERS).then(cache => cache.match(coverCacheKey(src))).then(async response => { if (!response?.ok) return; const blob = await response.blob(); if (active) { objectURL = URL.createObjectURL(blob); setFailed(''); setDownloaded({ src, blob: objectURL }); } }).catch(() => {});
    return () => { active = false; if (objectURL) URL.revokeObjectURL(objectURL); };
  }, [src])
  const unavailable = !!src && failed === src
  const loading = !!src && !unavailable && loaded !== src
  const fail = () => {
    // Keep previously cached full-size images usable when offline, too.
    if (url && (thumbnail || shelf) && original !== url && src !== coverImageUrl(url, false, attempt)) setOriginal(url)
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
  const dimensions = shelf ? 'w-full aspect-[2/3]' : thumbnail ? 'w-10 h-14' : 'w-32 h-48'
  return <div className={`shrink-0 ${shelf ? 'w-full' : thumbnail ? 'w-10' : 'w-32'}`}>
    {src && !unavailable ? <div className={`relative ${dimensions}`} aria-busy={loading}>
      {loading && <div role="status" aria-label={`Loading cover for ${title}`} className="absolute inset-0 rounded bg-gray-200 dark:bg-gray-700 motion-safe:animate-pulse flex items-center justify-center"><span aria-hidden="true" className="h-4 w-4 rounded-full border-2 border-gray-400 border-t-transparent motion-safe:animate-spin" /></div>}
      <img ref={image} key={src} src={displaySrc} alt={title} loading={thumbnail || shelf ? 'lazy' : 'eager'} decoding="async" referrerPolicy="no-referrer" className={`${shelf ? 'absolute inset-0 w-full h-full' : dimensions} object-contain rounded bg-gray-100 dark:bg-gray-700 transition-opacity motion-reduce:transition-none ${loading ? 'opacity-0' : 'opacity-100'}`} onError={fail} onLoad={event => { if (isBlankCover(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)) fail(); else setLoaded(src) }} />
    </div> : <div role="img" aria-label={unavailable ? `Cover unavailable for ${title}` : `No cover for ${title}`} className={`${dimensions} ${thumbnail ? 'text-xl' : 'text-4xl'} bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center`}>📖</div>}
    {unavailable && retry && <button type="button" className="text-xs text-blue-600 underline mt-2" onClick={() => { setAttempt(value => value + 1); setOriginal(''); setFailed('') }}>Retry image</button>}
  </div>
}
