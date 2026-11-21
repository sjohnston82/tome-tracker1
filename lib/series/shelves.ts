import { authorSortKey, formatAuthorName } from '@/lib/books/author-sort';
import { groupAuthors } from '@/lib/books/author-groups';
import { ownedEditions, type ChecklistEntry, type ChecklistSeries } from './checklist';
export function orderedSeriesEntries(entries: ChecklistEntry[]): ChecklistEntry[] {
  const position = (entry: ChecklistEntry) => entry.position === null || !Number.isFinite(Number(entry.position)) ? Infinity : Number(entry.position);
  return [...entries].sort((left, right) => position(left) - position(right));
}
export function seriesAuthor(series: ChecklistSeries): string {
  const main = series.entries.filter(entry => entry.entryType === 'MAIN');
  const counts = new Map<string, { name: string; count: number }>();
  for (const entry of main.length ? main : series.entries) {
    const name = entry.work.authorName.trim(); if (!name || /^unknown(?: author)?$/i.test(name)) continue;
    const key = formatAuthorName(name).normalize('NFKD').toLowerCase().replace(/[.\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    const current = counts.get(key); counts.set(key, { name: current?.name ?? name, count: (current?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || authorSortKey(a.name).localeCompare(authorSortKey(b.name), 'en') || a.name.localeCompare(b.name, 'en'))[0]?.name ?? 'Unknown author';
}
export function groupSeriesByAuthor(series: ChecklistSeries[]) {
  const authors = new Map<string, { id: string; name: string; series: ChecklistSeries[] }>();
  for (const item of series) {
    const name = seriesAuthor(item), key = formatAuthorName(name).normalize('NFKD').toLowerCase().replace(/[.\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
    if (!authors.has(key)) authors.set(key, { id: key, name, series: [] });
    authors.get(key)!.series.push(item);
  }
  for (const group of authors.values()) group.series.sort((a, b) => a.name.localeCompare(b.name, 'en'));
  const known = [...authors.values()].filter(group => group.name !== 'Unknown author'), unknown = [...authors.values()].filter(group => group.name === 'Unknown author');
  const groups = groupAuthors(known);
  if (unknown.length) { const other = groups.find(group => group.letter === '#'); if (other) other.authors.push(...unknown); else groups.unshift({ letter: '#', authors: unknown }); }
  return groups;
}
export function seriesEntryArtwork(entry: ChecklistEntry) {
  const editions = ownedEditions(entry);
  const pictured = editions.find(book => book.coverLocked && book.coverUrl) ?? editions.find(book => book.coverUrl);
  return { coverUrl: pictured?.coverUrl ?? null, allowReference: !pictured && !editions.some(book => book.coverLocked), editions };
}
