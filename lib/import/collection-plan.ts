import type { CollectionManifest } from './collection-validation'

export const normalizeCollectionIdentity = (value: string) => value.normalize('NFC').replace(/\u2019/g, "'").trim().replace(/\s+/g, ' ').toLowerCase()
export const collectionIdentity = (title: string, author: string) => `${normalizeCollectionIdentity(author)}\0${normalizeCollectionIdentity(title)}`

export type ExistingOwned = { id: string; title: string; author: { name: string }; importKey: string | null; readingStatus: string; publicationYear: number | null }
export type ExistingWork = { id: string; title: string; authorName: string; importKey: string | null; publicationYear: number | null }
export type ImportIssue = { code: string; sourceKey: string; message: string; blocking?: boolean; candidateIds?: string[] }

export function planCollectionImport(manifest: CollectionManifest, books: ExistingOwned[], works: ExistingWork[]) {
  const issues: ImportIssue[] = [...manifest.review]
  const claimedBooks = new Set<string>()
  const bookActions = manifest.books.map(source => {
    const pinned = books.find(b => b.importKey === source.sourceKey)
    const matches = pinned ? [pinned] : books.filter(b => collectionIdentity(b.title, b.author.name) === collectionIdentity(source.title, source.authorName))
    const existing = matches.length === 1 ? matches[0] : null
    if (matches.length > 1) issues.push({ code: 'AMBIGUOUS_EDITION', sourceKey: source.sourceKey, message: 'Several owned editions match; select an edition manually before importing.', blocking: true, candidateIds: matches.map(b => b.id) })
    if (existing && (claimedBooks.has(existing.id) || (existing.importKey && existing.importKey !== source.sourceKey))) issues.push({ code: 'IDENTITY_CONFLICT', sourceKey: source.sourceKey, message: 'Physical edition already represents another source row.', blocking: true })
    if (existing) {
      claimedBooks.add(existing.id)
      if (existing.readingStatus !== source.readingStatus) issues.push({ code: 'READING_CONFLICT', sourceKey: source.sourceKey, message: `Library status ${existing.readingStatus}; spreadsheet status ${source.readingStatus}. Library value is preserved.`, blocking: !pinned })
      if (existing.publicationYear !== source.publicationYear && source.publicationYear !== null) issues.push({ code: 'PUBLICATION_CONFLICT', sourceKey: source.sourceKey, message: 'Existing publication year is preserved; source year remains in the manifest.' })
    }
    return { source, existingId: existing?.id ?? null }
  })
  const uniqueWorks = new Map<string, CollectionManifest['series'][number]['entries'][number]>()
  for (const series of manifest.series) for (const entry of series.entries) {
    const prior = uniqueWorks.get(entry.sourceKey)
    if (prior && (collectionIdentity(prior.title, prior.authorName) !== collectionIdentity(entry.title, entry.authorName) || (prior.publicationYear !== null && entry.publicationYear !== null && prior.publicationYear !== entry.publicationYear))) issues.push({ code: 'WORK_METADATA_CONFLICT', sourceKey: entry.sourceKey, message: 'Overlapping series disagree about work metadata.', blocking: true })
    else if (prior && prior.publicationYear === null && entry.publicationYear !== null) uniqueWorks.set(entry.sourceKey, { ...prior, publicationYear: entry.publicationYear })
    else if (!prior) uniqueWorks.set(entry.sourceKey, entry)
  }
  const workActions = [...uniqueWorks.values()].map(source => {
    const pinned = works.find(w => w.importKey === source.sourceKey)
    const matches = pinned ? [pinned] : works.filter(w => collectionIdentity(w.title, w.authorName) === collectionIdentity(source.title, source.authorName))
    const existing = matches.length === 1 ? matches[0] : null
    if (matches.length > 1 || (existing?.importKey && existing.importKey !== source.sourceKey)) issues.push({ code: 'AMBIGUOUS_WORK', sourceKey: source.sourceKey, message: 'Work identity needs manual review.', blocking: true, candidateIds: matches.map(w => w.id) })
    if (existing && source.publicationYear !== null && existing.publicationYear !== source.publicationYear) issues.push({ code: 'PUBLICATION_CONFLICT', sourceKey: source.sourceKey, message: 'Existing work publication year is preserved.' })
    return { source, existingId: existing?.id ?? null }
  })
  return { bookActions, workActions, issues, ready: !issues.some(i => i.blocking),
    summary: { sourceOwned: manifest.books.length, newOwned: bookActions.filter(a => !a.existingId).length, existingOwned: bookActions.filter(a => a.existingId).length, additionalOwned: books.length - claimedBooks.size, newWorks: workActions.filter(a => !a.existingId).length, series: manifest.series.length, entries: manifest.series.reduce((n, s) => n + s.entries.length, 0), expectedStatuses: manifest.expected.statuses } }
}
