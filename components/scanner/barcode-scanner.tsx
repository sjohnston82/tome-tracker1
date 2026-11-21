"use client";

import { useEffect, useRef, useState } from "react";
import { BarcodeFormat, BrowserMultiFormatReader, DecodeHintType } from "@zxing/library";
import { extractIsbnFromBarcode } from "@/lib/books/isbn";

function cameraMessage(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Camera permission was denied. Allow camera access in your browser’s site settings, then try again.';
  if (name === 'NotFoundError') return 'No camera was found on this device.';
  if (name === 'NotReadableError') return 'The camera is busy. Close other apps using it, then try again.';
  return 'The camera could not start. Check camera permissions and try again.';
}

export function BarcodeScanner({ onScan, active }: { onScan: (code: string) => void; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onScanRef = useRef(onScan);
  const [attempt, setAttempt] = useState(0);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState('Position the main ISBN barcode in frame');

  // Parent state changes must not release and reacquire the camera.
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);
  useEffect(() => {
    if (!active) return;
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false, accepted = false;
    let stream: MediaStream | undefined;
    const hints = new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.CODE_128, BarcodeFormat.CODE_39]]]);
    const reader = new BrowserMultiFormatReader(hints, 250);
    const stopTracks = () => stream?.getTracks().forEach(track => track.stop());
    setStarting(true); setError(null); setHint('Position the main ISBN barcode in frame');
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          setError('Camera access needs HTTPS or localhost and a supported browser.');
          return;
        }
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 },
        } });
        if (cancelled) { stopTracks(); return; }
        await reader.decodeFromStream(stream, video, result => {
          if (cancelled || accepted || !result) return;
          const code = result.getText().trim();
          const isbn = extractIsbnFromBarcode(code);
          if (!isbn) {
            setHint(`Non-ISBN barcode detected: ${code}. Try the barcode inside the front cover, or enter the printed ISBN below.`);
            return;
          }
          // Lock synchronously: several frames can arrive before React updates active.
          accepted = true;
          reader.reset(); stopTracks();
          onScanRef.current(isbn);
        });
        // Camera permission/video startup may finish after navigating away.
        if (cancelled || accepted) { reader.stopContinuousDecode(); stopTracks(); }
      } catch (cause) {
        if (!cancelled) { reader.reset(); stopTracks(); setError(cameraMessage(cause)); }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();
    return () => { cancelled = true; reader.reset(); stopTracks(); };
  }, [active, attempt]);

  if (!active) return <p role="status" className="text-sm text-gray-500">Camera paused while you review this scan.</p>;

  return <div className="relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden">
    {/* A fresh video element isolates a late startup from the next scan attempt. */}
    <video key={`${active}:${attempt}`} ref={videoRef} className="absolute inset-0 w-full h-full object-contain" playsInline muted autoPlay />
    {active && !error && <>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><div className="w-64 max-w-[90%] h-32 border-2 border-white/50 rounded-lg" /></div>
      <p role="status" className="absolute bottom-4 left-4 right-4 text-center text-white text-sm bg-black/70 px-3 py-2 rounded-lg">{starting ? 'Starting camera…' : hint}</p>
    </>}
    {error && active && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white bg-gray-900">
      <p role="alert">{error}</p>
      <button type="button" className="border rounded-lg px-4 py-2 hover:bg-gray-800" onClick={() => setAttempt(value => value + 1)}>Retry camera</button>
    </div>}
  </div>;
}
