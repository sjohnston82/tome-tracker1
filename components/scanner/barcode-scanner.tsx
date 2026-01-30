"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader, NotFoundException } from "@zxing/library";

export function BarcodeScanner({
  onScan,
  active,
}: {
  onScan: (code: string) => void;
  active: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const lastCodeRef = useRef<string>("");
  const lastTimeRef = useRef<number>(0);

  const handleScan = useCallback(
    (code: string) => {
      const now = Date.now();
      if (code === lastCodeRef.current && now - lastTimeRef.current < 3000) {
        return;
      }
      lastCodeRef.current = code;
      lastTimeRef.current = now;
      onScan(code);
    },
    [onScan]
  );

  useEffect(() => {
    if (!active) {
      readerRef.current?.reset();
      return;
    }

    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    reader
      .decodeFromVideoDevice(undefined, videoRef.current!, (result, error) => {
        if (result) handleScan(result.getText());
        if (error && !(error instanceof NotFoundException)) console.error(error);
      })
      .then(() => setHasPermission(true))
      .catch(() => setHasPermission(false));

    return () => reader.reset();
  }, [active, handleScan]);

  if (hasPermission === false) {
    return (
      <div className="aspect-[3/4] bg-gray-900 rounded-lg flex items-center justify-center text-white text-center p-6">
        <div>
          <p className="text-4xl mb-4">📷</p>
          <p>Camera access required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[3/4] bg-gray-900 rounded-lg overflow-hidden">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover"
        playsInline
        muted
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-64 h-32 border-2 border-white/50 rounded-lg" />
      </div>
      <div className="absolute bottom-4 left-0 right-0 text-center">
        <p className="text-white/80 text-sm bg-black/50 inline-block px-4 py-2 rounded-full">
          Position barcode in frame
        </p>
      </div>
    </div>
  );
}
