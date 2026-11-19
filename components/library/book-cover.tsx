'use client'

import { useState } from 'react'
import { coverImageUrl, isBlankCover } from '@/lib/books/cover-image'

export function BookCover({ url, title, thumbnail = false, retry = false }: { url: string | null; title: string; thumbnail?: boolean; retry?: boolean }) {
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState('')
  const [original, setOriginal] = useState('')
  const src = url ? coverImageUrl(url, thumbnail && original !== url, attempt) : ''
  const unavailable = !!src && failed === src
  const fail = () => {
    // Keep previously cached full-size images usable when offline, too.
    if (url && thumbnail && original !== url && src !== coverImageUrl(url, false, attempt)) setOriginal(url)
    else setFailed(src)
  }
  return <div className={`shrink-0 ${thumbnail ? 'w-10' : 'w-32'}`}>
    {src && !unavailable ? <img key={src} src={src} alt={title} loading={thumbnail ? 'lazy' : 'eager'} decoding="async" referrerPolicy="no-referrer" className={`${thumbnail ? 'w-10 h-14' : 'w-32 h-48'} object-contain rounded bg-gray-100 dark:bg-gray-700`} onError={fail} onLoad={event => { if (isBlankCover(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)) fail() }} /> : <div role="img" aria-label={unavailable ? `Cover unavailable for ${title}` : `No cover for ${title}`} className={`${thumbnail ? 'w-10 h-14 text-xl' : 'w-32 h-48 text-4xl'} bg-gray-100 dark:bg-gray-700 rounded flex items-center justify-center`}>📖</div>}
    {unavailable && retry && <button type="button" className="text-xs text-blue-600 underline mt-2" onClick={() => { setAttempt(value => value + 1); setOriginal(''); setFailed('') }}>Retry image</button>}
  </div>
}
