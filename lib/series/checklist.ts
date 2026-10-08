export type EditionSummary = { id: string; title: string; readingStatus: 'UNKNOWN' | 'UNREAD' | 'READING' | 'READ'; isbn13: string | null }
export type ChecklistEntry = { id: string; position: string | number | null; entryType: string; isConfirmed: boolean; work: { id: string; title: string; authorName: string; publicationYear: number | null; editions: EditionSummary[]; containedIn: { book: EditionSummary }[] } }
export type ChecklistSeries = { id: string; name: string; description: string | null; entries: ChecklistEntry[] }

export function ownedEditions(entry: ChecklistEntry): EditionSummary[] {
  return [...new Map([...entry.work.editions, ...entry.work.containedIn.map(link => link.book)].map(book => [book.id, book])).values()]
}

export function checklistStats(series: ChecklistSeries) {
  let owned = 0, read = 0
  for (const entry of series.entries) {
    const editions = ownedEditions(entry)
    if (editions.length) owned++
    // Split-volume editions must all be read before marking the work read.
    if (editions.length && editions.every(book => book.readingStatus === 'READ')) read++
  }
  return { total: series.entries.length, owned, missing: series.entries.length - owned, read }
}
