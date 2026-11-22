import type { OwnershipExclusion } from './ownership-decisions'
import { authorPeople, formatAuthorName } from '@/lib/books/author-sort'
import { ownedEditions, type ChecklistEntry, type ChecklistSeries, type EditionSummary } from './checklist'

const text = (value: string) => value.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '').replace(/&/g, ' and ').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
const authorKey = (name: string) => authorPeople(name).map(person => text(formatAuthorName(person))).sort().join('|')
// Only punctuation and an optional leading article vary. Never drop subtitles or volume numbers.
const titleKey = (title: string) => text(title).replace(/^the /, '')
export const catalogIdentity = (title: string, author: string) => `${authorKey(author)}:${text(title)}`
export const ownershipIdentity = (title: string, author: string) => `${authorKey(author)}:${titleKey(title)}`
export function canonicalSeriesName(name: string, author: string): string {
  const key = text(name)
  if (authorKey(author) === authorKey('Steven Erikson')) {
    if (['witness', 'tales of witness'].includes(key)) return 'Tales of Witness'
    if (['bauchelain and korbal broach', 'baucherlain and korbal broach', 'bauchelain and korbal', 'baucherlain and korbal'].includes(key)) return 'Bauchelain & Korbal Broach'
  }
  return name
}
// Official numbered novels; Keyhole is 4.5 in story order, per Stephen King's site.
// https://stephenking.com/darktower/book/
const darkTower: Record<string, number> = { 'gunslinger': 1, 'drawing of the three': 2, 'waste lands': 3, 'wizard and glass': 4, 'wind through the keyhole': 4.5, 'wolves of the calla': 5, 'song of susannah': 6, 'dark tower': 7 }
export type CatalogBook = EditionSummary & { author: { name: string }; workId: string | null; contents: { workId: string }[] }

/** Non-destructive catalog reconciliation. IDs still target original records when editing. */
export function reconcileCatalog(source: ChecklistSeries[], books: CatalogBook[], exclusions: OwnershipExclusion[] = []): ChecklistSeries[] {
  const groups = new Map<string, ChecklistSeries[]>()
  for (const series of source) {
    const author = series.entries.find(entry => entry.entryType === 'MAIN')?.work.authorName ?? series.entries[0]?.work.authorName ?? ''
    const name = series.managed ? series.name : canonicalSeriesName(series.name, author)
    const key = `${text(name)}:${authorKey(author)}`
    const list = groups.get(key) ?? []; list.push(series); groups.set(key, list)
  }
  const catalog: ChecklistSeries[] = []
  for (const records of groups.values()) {
    const author = records[0].entries[0]?.work.authorName ?? ''
    const name = records.find(item => item.managed)?.name ?? canonicalSeriesName(records[0].name, author)
    // Prefer the correctly named record, then the one with the fuller checklist.
    const primary = [...records].sort((a, b) => Number(!!b.managed) - Number(!!a.managed) || Number(b.name === name) - Number(a.name === name) || b.entries.length - a.entries.length)[0]
    const entries = new Map<string, ChecklistEntry>()
    for (const record of [primary, ...records.filter(item => item !== primary)]) for (const entry of record.entries) {
      const key = `${catalogIdentity(entry.work.title, entry.work.authorName)}${entry.keepSeparate ? `:${entry.work.id}` : ''}`
      const incoming = { ...entry, ownershipWorkIds: entry.ownershipWorkIds ?? [entry.work.id], ownershipLinks: entry.ownershipLinks ?? [...entry.work.editions.map(book => ({ bookId: book.id, workId: entry.work.id, source: 'edition' as const })), ...entry.work.containedIn.map(link => ({ bookId: link.book.id, workId: entry.work.id, source: 'content' as const }))], seriesId: entry.seriesId ?? record.id, work: { ...entry.work, editions: [...entry.work.editions], containedIn: [...entry.work.containedIn] } }
      const previous = entries.get(key)
      if (!previous) entries.set(key, incoming)
      else if (previous.isConfirmed && incoming.isConfirmed && (String(previous.position) !== String(incoming.position) || previous.entryType !== incoming.entryType || (previous.work.publicationYear !== null && incoming.work.publicationYear !== null && previous.work.publicationYear !== incoming.work.publicationYear))) {
        // Conflicting manual corrections must remain distinct and available for review.
        entries.set(`${key}:${incoming.id}`, incoming)
      } else {
        // A confirmed correction wins. Ownership unions never create physical editions.
        const preferred = incoming.isConfirmed && !previous.isConfirmed ? incoming : previous
        const other = preferred === incoming ? previous : incoming
        entries.set(key, { ...preferred, ownershipWorkIds: [...new Set([...(preferred.ownershipWorkIds ?? [preferred.work.id]), ...(other.ownershipWorkIds ?? [other.work.id])])], ownershipLinks: [...new Map([...(preferred.ownershipLinks ?? []), ...(other.ownershipLinks ?? [])].map(link => [JSON.stringify(link), link])).values()], position: preferred.position ?? (preferred.isConfirmed ? null : other.position), work: { ...preferred.work, editions: [...new Map([...preferred.work.editions, ...other.work.editions].map(book => [book.id, book])).values()], containedIn: [...new Map([...preferred.work.containedIn, ...other.work.containedIn].map(link => [link.book.id, link])).values()] } })
      }
    }
    // An omnibus already represented by its contents is not an extra installment.
    const all = [...entries.values()]
    const installments = all.filter(entry => entry.isConfirmed || !ownedEditions(entry).some(book => {
      if (titleKey(book.title) !== titleKey(entry.work.title)) return false
      const contents = all.filter(other => other.work.id !== entry.work.id && other.work.containedIn.some(link => link.book.id === book.id))
      return new Set(contents.map(other => other.work.id)).size >= 2
    }))
    catalog.push({ ...primary, name, sourceSeriesIds: records.flatMap(item => item.sourceSeriesIds ?? [item.id]), entries: installments.map(entry => {
      if (text(name) === 'the dark tower' && authorKey(entry.work.authorName) === authorKey('Stephen King') && entry.position === null && !entry.isConfirmed) {
        const position = darkTower[titleKey(entry.work.title)]
        if (position !== undefined) return { ...entry, position, positionSource: 'https://stephenking.com/darktower/book/' }
      }
      return entry
    }) })
  }
  // Match only unlinked physical editions to exactly one catalog work. Multiple candidate
  // works remain missing for manual review; an existing different link is never inferred away.
  const works = new Map<string, Set<string>>()
  for (const series of catalog) for (const entry of series.entries) {
    const key = ownershipIdentity(entry.work.title, entry.work.authorName), ids = works.get(key) ?? new Set<string>()
    ids.add(entry.work.id); works.set(key, ids)
  }
  return catalog.map(series => ({ ...series, entries: series.entries.map(entry => {
    const key = ownershipIdentity(entry.work.title, entry.work.authorName)
    const matched = works.get(key)?.size === 1 ? books.filter(book => !exclusions.some(pair => pair.bookId === book.id && (entry.ownershipWorkIds ?? [entry.work.id]).includes(pair.workId)) && authorKey(book.author.name) && !/^unknown(?: author)?$/.test(text(book.author.name)) && !book.workId && !book.contents.length && ownershipIdentity(book.title, book.author.name) === key) : []
    return { ...entry, ownershipLinks: [...new Map([...(entry.ownershipLinks ?? []), ...matched.map(book => ({ bookId: book.id, workId: entry.work.id, source: 'match' as const }))].map(link => [JSON.stringify(link), link])).values()], work: { ...entry.work, editions: [...new Map([...entry.work.editions, ...matched].map(book => [book.id, book])).values()] } }
  }) }))
}
