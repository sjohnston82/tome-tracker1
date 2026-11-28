import type { CollectionManifest } from '@/lib/import/collection-validation'

export const bookKey = 'book:' + 'a'.repeat(64)
export const workKey = 'work:' + 'b'.repeat(64)
export const missingKey = 'work:' + 'c'.repeat(64)
export const collectionFixture = (): CollectionManifest => ({
  version: 1, dataset: 'tome-collection', sourceHashes: { xlsx: 'd'.repeat(64), docx: 'e'.repeat(64) },
  expected: { owned: 1, statuses: { READ: 1, UNREAD: 0, READING: 0, UNKNOWN: 0 } },
  books: [{ sourceKey: bookKey, title: 'An Omnibus', authorName: 'An Author', seriesName: 'A Series', readingStatus: 'READ', publicationYear: null, source: { file: 'master.xlsx', sheet: 'Collection', row: 2 } }],
  series: [{ sourceKey: 'series:' + 'f'.repeat(64), name: 'A Series', entries: [
    { sourceKey: workKey, title: 'First Novella', authorName: 'An Author', publicationYear: 1990, position: 0.5, entryType: 'NOVELLA', ownedSourceKeys: [bookKey], sourceOwnership: 'Owned (in An Omnibus)', source: { file: 'catalog.docx', heading: 'A Series', row: 2 } },
    { sourceKey: missingKey, title: 'Second Novel', authorName: 'An Author', publicationYear: 1995, position: 1, entryType: 'MAIN', ownedSourceKeys: [], sourceOwnership: 'Not Owned', source: { file: 'catalog.docx', heading: 'A Series', row: 3 } },
  ] }], review: [],
})
