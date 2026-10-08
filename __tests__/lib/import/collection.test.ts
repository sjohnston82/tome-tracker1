import { describe, it, expect } from 'vitest'
import { collectionFixture, bookKey } from '../../fixtures/collection'
import { collectionManifestSchema } from '@/lib/import/collection-validation'
import { planCollectionImport } from '@/lib/import/collection-plan'

describe('collection import planning', () => {
  it('keeps omnibus contents and missing works separate from physical ownership', () => {
    const plan = planCollectionImport(collectionFixture(), [], [])
    expect(plan.summary).toMatchObject({ sourceOwned: 1, newOwned: 1, newWorks: 2, entries: 2 })
    expect(plan.workActions[1].source.ownedSourceKeys).toEqual([])
  })
  it('rejects an incorrect source status count', () => {
    const manifest = collectionFixture()
    manifest.expected.statuses.READ = 0
    expect(collectionManifestSchema.safeParse(manifest).success).toBe(false)
  })
  it('rejects duplicate physical source keys', () => {
    const manifest = collectionFixture()
    manifest.books.push(manifest.books[0])
    expect(collectionManifestSchema.safeParse(manifest).success).toBe(false)
  })
  it('rejects ownership links outside the authoritative workbook', () => {
    const manifest = collectionFixture()
    manifest.series[0].entries[0].ownedSourceKeys = ['book:' + 'f'.repeat(64)]
    expect(collectionManifestSchema.safeParse(manifest).success).toBe(false)
  })
  it('reuses a corrected edition using its stable import key', () => {
    const plan = planCollectionImport(collectionFixture(), [{ id: 'edition', title: 'Manually corrected', author: { name: 'Corrected Author' }, readingStatus: 'READ', importKey: bookKey, publicationYear: 2001 }], [])
    expect(plan.ready).toBe(true)
    expect(plan.bookActions[0].existingId).toBe('edition')
    expect(plan.summary.newOwned).toBe(0)
  })
  it('requires review when several existing editions match', () => {
    const edition = { title: 'An Omnibus', author: { name: 'An Author' }, readingStatus: 'READ', importKey: null, publicationYear: null }
    const plan = planCollectionImport(collectionFixture(), [{ ...edition, id: 'one' }, { ...edition, id: 'two' }], [])
    expect(plan.ready).toBe(false)
    expect(plan.issues[0]).toMatchObject({ code: 'AMBIGUOUS_EDITION', candidateIds: ['one', 'two'] })
  })
  it('does not conflate split-volume editions', () => {
    const manifest = collectionFixture()
    manifest.books[0].title = 'A Novel, Part 1'
    const plan = planCollectionImport(manifest, [{ id: 'part-two', title: 'A Novel, Part 2', author: { name: 'An Author' }, readingStatus: 'READ', importKey: null, publicationYear: null }], [])
    expect(plan.bookActions[0].existingId).toBeNull()
    expect(plan.summary.additionalOwned).toBe(1)
  })
  it('blocks initial conflicting reading statuses and preserves later manual status edits', () => {
    const edition = { id: 'edition', title: 'An Omnibus', author: { name: 'An Author' }, readingStatus: 'UNREAD', importKey: null, publicationYear: null }
    expect(planCollectionImport(collectionFixture(), [edition], []).ready).toBe(false)
    expect(planCollectionImport(collectionFixture(), [{ ...edition, importKey: bookKey }], []).ready).toBe(true)
  })
  it('rejects conflicting metadata for a work in overlapping series', () => {
    const manifest = collectionFixture()
    manifest.series.push({ ...manifest.series[0], name: 'A Universe', entries: [{ ...manifest.series[0].entries[0], publicationYear: 2000 }] })
    expect(planCollectionImport(manifest, [], []).issues).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'WORK_METADATA_CONFLICT', blocking: true })]))
  })
})
