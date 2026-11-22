"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useCacheOwner } from '@/lib/offline/owner';
import type { ShelfMode } from '@/lib/series/checklist';
import type { MergePreview, MergeResolution } from '@/lib/series/merge-types';
type Option = { id: string; name: string; _count: { entries: number } };
export default function SeriesMergePage() {
  const owner = useCacheOwner(), epoch = useRef(0), saving = useRef(false);
  const [loadedOwner, setLoadedOwner] = useState(''), [options, setOptions] = useState<Option[]>([]), [load, setLoad] = useState(0);
  const [targetId, setTargetId] = useState(''), [sourceId, setSourceId] = useState(''), [name, setName] = useState('');
  const [preview, setPreview] = useState<MergePreview | null>(null), [resolutions, setResolutions] = useState<Record<string, MergeResolution>>({});
  const [visibilityChoice, setVisibilityChoice] = useState<ShelfMode | ''>('automatic');
  const [description, setDescription] = useState(''), [descriptionChoice, setDescriptionChoice] = useState(''), [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState(''), [noticeOwner, setNoticeOwner] = useState(''), [online, setOnline] = useState(true);
  useEffect(() => {
    const token = ++epoch.current, controller = new AbortController();
    setOptions([]); setPreview(null); setResolutions({}); setTargetId(''); setSourceId(''); setName(''); setError(''); setBusy(false); saving.current = false;
    fetch('/api/series/merge', { cache: 'no-store', signal: controller.signal }).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? 'Series could not be loaded.');
      if (epoch.current === token) { setOptions(data.series); setLoadedOwner(String(owner)); }
    }).catch(e => { if (epoch.current === token && !controller.signal.aborted) setError(e.message); });
    return () => { epoch.current++; controller.abort(); };
  }, [owner, load]);
  useEffect(() => { const update = () => setOnline(navigator.onLine); update(); window.addEventListener('online', update); window.addEventListener('offline', update); return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); }; }, []);
  const currentOptions = loadedOwner === String(owner) ? options : [];
  const invalidate = () => { setPreview(null); setResolutions({}); setConfirmed(false); setError(''); setNotice(''); };
  const run = async (apply: boolean) => {
    if (saving.current || !online || loadedOwner !== String(owner)) return;
    saving.current = true; setBusy(true); setError(''); const token = epoch.current;
    try {
      const body = apply && preview ? { mode: 'apply', targetId: preview.targetId, sourceId: preview.sourceId, name: preview.name, version: preview.version, visibility: visibilityChoice, description: description || null, resolutions: Object.values(resolutions) } : { mode: 'preview', targetId, sourceId, name };
      const response = await fetch('/api/series/merge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await response.json(); if (!response.ok) throw new Error(data.message ?? 'The merge could not be verified. Refresh before trying again.');
      if (epoch.current !== token) return;
      if (apply) { setPreview(null); setNoticeOwner(String(owner)); setNotice(`Merged into ${data.merged.name}. Physical books and reading history were preserved.`); setLoad(value => value + 1); }
      else { setPreview(data.preview); setVisibilityChoice((data.preview.targetVisibility ?? 'automatic') === (data.preview.sourceVisibility ?? 'automatic') ? (data.preview.targetVisibility ?? 'automatic') : ''); setResolutions({}); setConfirmed(false); setDescription(data.preview.targetDescription ?? data.preview.sourceDescription ?? ''); setDescriptionChoice(data.preview.targetDescription && data.preview.sourceDescription && data.preview.targetDescription !== data.preview.sourceDescription ? '' : 'automatic'); }
    } catch (e) { if (epoch.current === token) { setPreview(null); setConfirmed(false); setError(e instanceof Error ? e.message : 'The merge could not be verified. Refresh before trying again.'); } }
    finally { if (epoch.current === token) { saving.current = false; setBusy(false); } }
  };
  const ready = !!preview && preview.groups.every(group => !group.needsResolution || resolutions[group.id]) && !!descriptionChoice && !!visibilityChoice && confirmed;
  return <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
    <Link href="/series" className="text-blue-600 underline">Back to Series</Link>
    <div><h1 className="text-3xl font-bold">Merge duplicate series</h1><p className="text-gray-500 mt-2">Compare the saved checklists, choose a canonical name, and resolve duplicates before saving one series. Original work records and physical-copy links are preserved.</p></div>
    {!online && <p role="status">You are offline. Merge previews and saves require a connection.</p>}
    {notice && noticeOwner === String(owner) && <p role="status" className="text-green-700">{notice}</p>}
    {error && <div role="alert"><p className="text-red-700">{error}</p><Button variant="secondary" disabled={busy || !online} onClick={() => setLoad(value => value + 1)}>Refresh series</Button></div>}
    <form className="border rounded-xl p-5 space-y-4" onSubmit={event => { event.preventDefault(); void run(false); }}>
      <div className="grid sm:grid-cols-2 gap-4"><label>Series to keep<select aria-label="Series to keep" className="block w-full border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={targetId} disabled={busy} onChange={event => { invalidate(); setTargetId(event.target.value); setName(currentOptions.find(item => item.id === event.target.value)?.name ?? ''); }}><option value="">Choose a series…</option>{currentOptions.map(item => <option key={item.id} value={item.id}>{item.name} ({item._count.entries} entries)</option>)}</select></label>
      <label>Series to combine<select aria-label="Series to combine" className="block w-full border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={sourceId} disabled={busy} onChange={event => { invalidate(); setSourceId(event.target.value); }}><option value="">Choose another series…</option>{currentOptions.filter(item => item.id !== targetId).map(item => <option key={item.id} value={item.id}>{item.name} ({item._count.entries} entries)</option>)}</select></label></div>
      <label className="block">Canonical series name<input required maxLength={250} className="block w-full border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={loadedOwner === String(owner) ? name : ''} disabled={busy} onChange={event => { invalidate(); setName(event.target.value); }} /></label>
      <Button type="submit" disabled={busy || !online || !targetId || !sourceId || targetId === sourceId || !name.trim()}>{busy && !preview ? 'Loading preview…' : 'Preview merge'}</Button>
    </form>
    {preview && loadedOwner === String(owner) && <section aria-label="Merge preview" className="space-y-5">
      <h2 className="text-xl font-semibold">{preview.targetName} + {preview.sourceName} → {preview.name}</h2>
      <p className="text-sm text-gray-500">Saved ownership links stay attached to their original work records. Combining duplicate works chooses which metadata to display; it does not rewrite the original works or other series. Keeping them separate retains distinct checklist entries.</p>
      {preview.groups.map(group => <fieldset key={group.id} className="border rounded-xl p-4 space-y-3"><legend className="font-semibold px-1">{group.choices[0].title}{group.needsResolution ? ' · Choose a resolution' : ' · Ready'}</legend>
        <div className="grid md:grid-cols-2 gap-3">{group.choices.map(choice => <div key={`${choice.entryId}:${choice.workId}`} className="bg-gray-50 dark:bg-gray-900 rounded-lg p-3 text-sm space-y-1"><p className="font-medium">{choice.seriesName}</p><p>{choice.title} — {choice.author}</p><p>Year: {choice.year ?? 'Unknown'} · Position: {choice.position ?? 'Unknown'} · {choice.entryType.toLowerCase()} · {choice.confirmed ? 'Order confirmed' : 'Order unconfirmed'}</p><p>{choice.owned} saved physical-copy {choice.owned === 1 ? 'link' : 'links'}</p>
          {group.needsResolution && <label className="flex gap-2 items-start pt-2"><input type="radio" name={`resolution-${group.id}`} disabled={busy} checked={resolutions[group.id]?.mode === 'combined' && resolutions[group.id]?.entryId === choice.entryId && resolutions[group.id]?.workId === choice.workId} onChange={() => { setConfirmed(false); setResolutions(value => ({ ...value, [group.id]: { groupId: group.id, mode: 'combined', entryId: choice.entryId, workId: choice.workId } })); }} />Use this metadata and order for one combined entry</label>}
        </div>)}</div>
        {group.needsResolution && group.canSeparate && <label className="flex gap-2 items-center text-sm"><input type="radio" name={`resolution-${group.id}`} disabled={busy} checked={resolutions[group.id]?.mode === 'separate'} onChange={() => { setConfirmed(false); setResolutions(value => ({ ...value, [group.id]: { groupId: group.id, mode: 'separate', entryId: group.choices[0].entryId, workId: group.choices[0].workId } })); }} />Keep each work record as a separate entry</label>}
      </fieldset>)}
      {preview.targetDescription && preview.sourceDescription && preview.targetDescription !== preview.sourceDescription && <fieldset className="border rounded-xl p-4 space-y-2"><legend>Descriptions differ</legend>{[['target', preview.targetName, preview.targetDescription], ['source', preview.sourceName, preview.sourceDescription]].map(([key, label, value]) => <label key={key} className="block"><input type="radio" name="description-choice" checked={descriptionChoice === key} disabled={busy} onChange={() => { setDescriptionChoice(key); setDescription(value); setConfirmed(false); }} /> Keep description from {label}: {value}</label>)}</fieldset>}
      <label className="block text-sm">Retained description<textarea maxLength={4000} className="block w-full border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={description} disabled={busy} onChange={event => { setDescription(event.target.value); setDescriptionChoice('custom'); setConfirmed(false); }} /></label>
      <label className="block text-sm">Retained shelf preference<select className="block border rounded p-2 mt-1 bg-white dark:bg-gray-900" value={visibilityChoice} disabled={busy} onChange={event => { setVisibilityChoice(event.target.value as ShelfMode | ''); setConfirmed(false); }}><option value="">Choose a shelf preference…</option><option value="automatic">Automatic</option><option value="following">Following</option><option value="hidden">Hidden</option></select></label>
      {preview.targetVisibility !== preview.sourceVisibility && <p className="text-sm text-amber-700">Shelf preferences differ: {preview.targetName} is {preview.targetVisibility}; {preview.sourceName} is {preview.sourceVisibility}. Choose the retained preference.</p>}
      <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} disabled={busy} onChange={event => setConfirmed(event.target.checked)} /><span>I reviewed this preview and want to replace these two series checklists with one. My physical books and reading history stay intact.</span></label>
      <Button disabled={!ready || busy || !online} onClick={() => void run(true)}>{busy ? 'Merging…' : 'Confirm series merge'}</Button>
    </section>}
  </div>;
}
