"use client";
import { useEffect, useRef, useState } from 'react';
import { BookCover } from '@/components/library/book-cover';
import { useCacheOwner } from '@/lib/offline/owner';
import { usePreferences } from '@/lib/preferences';

// Share lookups across overlapping series and limit provider traffic while scrolling.
const results = new Map<string, { url: string | null; expires: number }>();
const pending = new Map<string, Promise<string | null>>();
let running = 0;
const queue: (() => void)[] = [];
function lookup(key: string, id: string, wanted: () => boolean): Promise<string | null> {
  const cached = results.get(key);
  if (cached && cached.expires > Date.now()) return Promise.resolve(cached.url);
  const active = pending.get(key);
  if (active) return active;
  const task = new Promise<string | null>((resolve, reject) => {
    const run = () => {
      if (!wanted()) { reject(new Error('Cover no longer visible')); return; }
      running++;
      fetch(`/api/works/${id}/cover`, { cache: 'no-store' }).then(async response => {
        if (!response.ok) throw new Error('Cover unavailable');
        const data = await response.json();
        const url = typeof data.coverUrl === 'string' ? data.coverUrl : null;
        if (results.size >= 1000) results.delete(results.keys().next().value!);
        results.set(key, { url, expires: Date.now() + (url ? 86_400_000 : 900_000) });
        resolve(url);
      }).catch(reject).finally(() => { running--; queue.shift()?.(); });
    };
    if (running < 2) run(); else queue.push(run);
  }).finally(() => { pending.delete(key); if (running < 2) queue.shift()?.(); });
  pending.set(key, task);
  return task;
}
export function ReferenceCover({ workId, title, author, savedUrl, allowReference }: { workId: string; title: string; author: string; savedUrl: string | null; allowReference: boolean }) {
  const owner = useCacheOwner(), { preferences } = usePreferences();
  const element = useRef<HTMLDivElement>(null);
  const [reference, setReference] = useState<{ key: string; url: string | null } | null>(null);
  const [failed, setFailed] = useState(false);
  const key = `${owner}:${workId}:${title}:${author}`;
  useEffect(() => {
    let active = true;
    if (savedUrl || !allowReference || !owner || !preferences.autoCovers) return;
    const load = () => {
      observer?.disconnect(); setFailed(false);
      lookup(key, workId, () => active).then(url => { if (active) setReference({ key, url }); }).catch(() => { if (active) setFailed(true); });
    };
    const observer = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) load(); }, { rootMargin: '160px' });
    if (observer && element.current) observer.observe(element.current); else load();
    return () => { active = false; observer?.disconnect(); };
  }, [key, workId, savedUrl, allowReference, owner, preferences.autoCovers]);
  return <div ref={element}><BookCover url={savedUrl ?? (allowReference && owner && reference?.key === key ? reference.url : null)} title={title} shelf />{failed && <span className="block text-xs mt-1">Cover unavailable</span>}</div>;
}
