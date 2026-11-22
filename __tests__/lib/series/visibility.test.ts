import { describe, it, expect } from 'vitest'
import { isSeriesVisible } from '@/lib/series/shelf-preference'
import { managementSchema, remapManagementState } from '@/lib/series/management-state'
const series = { id: 's', name: 'Series', description: null, entries: [] }, options = { showUnowned: false, showHidden: false, selected: null }
describe('shelf preference behavior', () => {
  it('keeps following shelves visible independently of physical ownership', () => { expect(isSeriesVisible(series, options)).toBe(false); expect(isSeriesVisible({ ...series, visibility: 'following' }, options)).toBe(true) })
  it('keeps hidden shelves out of searches and selected details until explicitly shown', () => { expect(isSeriesVisible({ ...series, visibility: 'hidden' }, { ...options, showUnowned: true, selected: 's' })).toBe(false); expect(isSeriesVisible({ ...series, visibility: 'hidden' }, { ...options, showHidden: true })).toBe(true) })
  it('validates preference records and remaps them on restore', () => { const revision = '11111111-1111-4111-8111-111111111111'; const state = { version: 1, redirects: [], groups: [], visibility: [{ seriesId: 's', mode: 'following', revision }] }; expect(remapManagementState(state, new Map([['s', 'restored']]), new Map()).visibility[0].seriesId).toBe('restored'); expect(managementSchema.safeParse({ ...state, visibility: [...state.visibility, ...state.visibility] }).success).toBe(false) })
})
