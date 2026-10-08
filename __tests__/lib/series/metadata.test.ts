// @vitest-environment node
import { describe, it, expect, vi, afterEach } from 'vitest'
import { lookupWorkMetadata } from '@/lib/series/metadata'

afterEach(() => vi.unstubAllGlobals())
const stub = (docs: unknown[]) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs }) }))
describe('work metadata proposals', () => {
  it('returns a work-level original publication year without persisting it', async () => {
    stub([{ key: '/works/OL1W', title: 'A Novel', author_name: ['An Author'], first_publish_year: 1990 }])
    expect(await lookupWorkMetadata('A Novel', 'An Author')).toMatchObject({ state: 'matched', candidates: [{ publicationYear: 1990, sourceUrl: 'https://openlibrary.org/works/OL1W' }] })
  })
  it('requires review when title matches but author does not', async () => {
    stub([{ key: 'OL1W', title: 'A Novel', author_name: ['Another Author'] }])
    expect((await lookupWorkMetadata('A Novel', 'An Author')).state).toBe('review')
  })
  it('requires review when exact matches disagree', async () => {
    stub([{ key: 'OL1W', title: 'A Novel', author_name: ['An Author'], first_publish_year: 1990 }, { key: 'OL2W', title: 'A Novel', author_name: ['An Author'], first_publish_year: 2000 }])
    expect((await lookupWorkMetadata('A Novel', 'An Author')).state).toBe('review')
  })
  it('leaves an absent publication year unknown', async () => {
    stub([{ key: 'OL1W', title: 'A Novel', author_name: ['An Author'] }])
    expect((await lookupWorkMetadata('A Novel', 'An Author')).candidates[0].publicationYear).toBeNull()
  })
  it('rejects provider-supplied URLs and edition identifiers', async () => {
    stub([{ key: 'https://evil.test', title: 'A Novel' }, { key: 'OL1M', title: 'A Novel' }])
    expect((await lookupWorkMetadata('A Novel', 'An Author')).candidates).toEqual([])
  })
  it('reports a provider outage explicitly', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('timeout')))
    expect((await lookupWorkMetadata('A Novel', 'An Author')).state).toBe('unavailable')
  })
})
