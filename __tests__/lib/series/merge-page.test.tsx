import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import Page from '@/app/series/merge/page'
const targetId = 'one', sourceId = 'two', version = 'a'.repeat(64)
const choices = [{ entryId: 'entry-one', workId: 'work-one', seriesId: targetId, seriesName: 'Tales', title: 'A Novel', author: 'Author', year: 2025, position: '1', entryType: 'MAIN', confirmed: true, owned: 1 }, { entryId: 'entry-two', workId: 'work-two', seriesId: sourceId, seriesName: 'Witness', title: 'A Novel', author: 'Author', year: 2026, position: '2', entryType: 'NOVELLA', confirmed: false, owned: 0 }]
const preview = { targetId, sourceId, name: 'Tales', targetName: 'Tales', sourceName: 'Witness', targetDescription: null, sourceDescription: null, version, groups: [{ id: 'group', choices, needsResolution: true, canSeparate: true }] }
let fetcher: ReturnType<typeof vi.fn>
beforeEach(() => { fetcher = vi.fn(async (_url: string, options?: { body?: string }) => ({ ok: true, json: async () => !options?.body ? { series: [{ id: targetId, name: 'Tales', _count: { entries: 1 } }, { id: sourceId, name: 'Witness', _count: { entries: 1 } }] } : JSON.parse(options.body).mode === 'preview' ? { preview } : { merged: { name: 'Tales' } } })); vi.stubGlobal('fetch', fetcher) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
async function openPreview() { render(<Page />); await screen.findAllByRole('option', { name: 'Tales (1 entries)' }); fireEvent.change(screen.getByLabelText('Series to keep'), { target: { value: targetId } }); fireEvent.change(screen.getByLabelText('Series to combine'), { target: { value: sourceId } }); fireEvent.click(screen.getByRole('button', { name: 'Preview merge' })); await screen.findByRole('region', { name: 'Merge preview' }) }
describe('reviewable series cleanup', () => {
  it('previews without applying and requires both a conflict choice and final confirmation', async () => { await openPreview(); const apply = screen.getByRole('button', { name: 'Confirm series merge' }) as HTMLButtonElement; expect(apply.disabled).toBe(true); fireEvent.click(screen.getAllByRole('radio', { name: 'Use this metadata and order for one combined entry' })[0]); expect(apply.disabled).toBe(true); fireEvent.click(screen.getByRole('checkbox')); fireEvent.click(apply); await waitFor(() => expect(fetcher).toHaveBeenCalledWith('/api/series/merge', expect.objectContaining({ body: JSON.stringify({ mode: 'apply', targetId, sourceId, name: 'Tales', version, visibility: 'automatic', description: null, resolutions: [{ groupId: 'group', mode: 'combined', entryId: 'entry-one', workId: 'work-one' }] }) }))) })
  it('offers keep-separate and invalidates the preview when the canonical name changes', async () => { await openPreview(); fireEvent.click(screen.getByRole('radio', { name: 'Keep each work record as a separate entry' })); fireEvent.click(screen.getByRole('checkbox')); expect((screen.getByRole('button', { name: 'Confirm series merge' }) as HTMLButtonElement).disabled).toBe(false); fireEvent.change(screen.getByLabelText('Canonical series name'), { target: { value: 'Changed' } }); expect(screen.queryByRole('region', { name: 'Merge preview' })).toBeNull(); expect(fetcher.mock.calls.filter(call => call[1]?.body && JSON.parse(call[1].body).mode === 'apply')).toHaveLength(0) })
  it('does not automatically retry a stale merge', async () => { await openPreview(); fireEvent.click(screen.getAllByRole('radio')[0]); fireEvent.click(screen.getByRole('checkbox')); fetcher.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ message: 'Create a fresh preview.' }) }); fireEvent.click(screen.getByRole('button', { name: 'Confirm series merge' })); await screen.findByText('Create a fresh preview.'); expect(screen.queryByRole('region', { name: 'Merge preview' })).toBeNull(); expect(fetcher).toHaveBeenCalledTimes(3) })
})

it('requires a retained preference when one source is followed and the other hidden', async () => {
  const base = fetcher.getMockImplementation()! as (url: string, options?: { body?: string }) => Promise<unknown>
  fetcher.mockImplementation(async (url: string, options?: { body?: string }) => options?.body && JSON.parse(options.body).mode === 'preview' ? { ok: true, json: async () => ({ preview: { ...preview, targetVisibility: 'following', sourceVisibility: 'hidden' } }) } : base(url, options))
  await openPreview()
  fireEvent.click(screen.getAllByRole('radio')[0]); fireEvent.click(screen.getByRole('checkbox'))
  expect((screen.getByRole('button', { name: 'Confirm series merge' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.change(screen.getByLabelText('Retained shelf preference'), { target: { value: 'following' } })
  fireEvent.click(screen.getByRole('checkbox'))
  expect((screen.getByRole('button', { name: 'Confirm series merge' }) as HTMLButtonElement).disabled).toBe(false)
})
