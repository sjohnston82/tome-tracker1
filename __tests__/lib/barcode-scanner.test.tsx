import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BarcodeScanner } from '@/components/scanner/barcode-scanner';

type Callback = (result: { getText: () => string } | null) => void;
const harness = vi.hoisted(() => ({ readers: [] as { callback?: Callback; reset: ReturnType<typeof vi.fn>; stopContinuousDecode: ReturnType<typeof vi.fn>; decodeFromStream: ReturnType<typeof vi.fn> }[] }));
vi.mock('@zxing/library', () => ({
  BarcodeFormat: { EAN_13: 7 }, DecodeHintType: { POSSIBLE_FORMATS: 2 },
  BrowserMultiFormatReader: vi.fn(function () {
    const reader = { callback: undefined as Callback | undefined, reset: vi.fn(), stopContinuousDecode: vi.fn(), decodeFromStream: vi.fn() };
    reader.decodeFromStream.mockImplementation(async (_stream, _video, callback: Callback) => { reader.callback = callback; });
    harness.readers.push(reader); return reader;
  }),
}));
const stop = vi.fn();
const stream = { getTracks: () => [{ stop }] };
const media = vi.fn();
const scan = (index: number, code: string) => act(() => harness.readers[index].callback?.({ getText: () => code }));
beforeEach(() => { harness.readers.length = 0; stop.mockClear(); media.mockReset().mockResolvedValue(stream); vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: media } }); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('phone barcode scanner lifecycle', () => {
  it('keeps the camera running across parent renders and calls the latest handler exactly once per attempt', async () => {
    const first = vi.fn(), latest = vi.fn();
    const { rerender } = render(<BarcodeScanner active onScan={first} />);
    await waitFor(() => expect(harness.readers[0].callback).toBeDefined());
    rerender(<BarcodeScanner active onScan={latest} />);
    expect(media).toHaveBeenCalledOnce();
    expect(media.mock.calls[0][0]).toMatchObject({ audio: false, video: { facingMode: { ideal: 'environment' } } });
    scan(0, '9780765311788'); scan(0, '9780765311788'); scan(0, '9780306406157');
    expect(first).not.toHaveBeenCalled(); expect(latest).toHaveBeenCalledExactlyOnceWith('9780765311788');
    expect(stop).toHaveBeenCalled();
  });
  it('allows an immediate deliberate rescan of the same book and ignores stale camera callbacks', async () => {
    const onScan = vi.fn(); const { rerender } = render(<BarcodeScanner active onScan={onScan} />);
    await waitFor(() => expect(harness.readers[0].callback).toBeDefined());
    scan(0, '9780765311788');
    rerender(<BarcodeScanner active={false} onScan={onScan} />);
    rerender(<BarcodeScanner active onScan={onScan} />);
    await waitFor(() => expect(harness.readers[1].callback).toBeDefined());
    scan(0, '9780306406157'); scan(1, '9780765311788');
    expect(onScan).toHaveBeenCalledTimes(2); expect(onScan.mock.calls.map(call => call[0])).toEqual(['9780765311788', '9780765311788']);
  });
  it('keeps scanning through non-book codes and invalid check digits', async () => {
    const onScan = vi.fn(); render(<BarcodeScanner active onScan={onScan} />);
    await waitFor(() => expect(harness.readers[0].callback).toBeDefined());
    scan(0, '4006381333931'); scan(0, '9780765311789');
    expect(onScan).not.toHaveBeenCalled(); expect(screen.getByRole('status').textContent).toContain('978 or 979');
    scan(0, '9780765311788'); expect(onScan).toHaveBeenCalledOnce();
  });
  it('stops a permission request that finishes after the scanner unmounts', async () => {
    let grant!: (value: typeof stream) => void;
    media.mockImplementation(() => new Promise(resolve => { grant = resolve; }));
    const { unmount } = render(<BarcodeScanner active onScan={vi.fn()} />); unmount();
    await act(async () => { grant(stream); });
    expect(stop).toHaveBeenCalledOnce(); expect(harness.readers[0].decodeFromStream).not.toHaveBeenCalled();
  });
  it('offers a working camera retry after permission failure without losing the video element', async () => {
    media.mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    render(<BarcodeScanner active onScan={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('permission was denied');
    fireEvent.click(screen.getByRole('button', { name: 'Retry camera' }));
    await waitFor(() => expect(harness.readers[1].callback).toBeDefined());
    expect(harness.readers[1].decodeFromStream.mock.calls[0][1]).toBeInstanceOf(HTMLVideoElement);
    expect(screen.queryByRole('alert')).toBeNull();
  });
  it('explains unavailable camera access and does not start when inactive', async () => {
    vi.stubGlobal('navigator', {});
    const { rerender } = render(<BarcodeScanner active={false} onScan={vi.fn()} />);
    expect(screen.getByText('Camera paused while you review this scan.')).toBeDefined(); expect(media).not.toHaveBeenCalled(); expect(document.querySelector('video')).toBeNull();
    rerender(<BarcodeScanner active onScan={vi.fn()} />);
    expect((await screen.findByRole('alert')).textContent).toContain('HTTPS or localhost');
  });
});
