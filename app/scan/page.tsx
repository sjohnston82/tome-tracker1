"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "@/components/scanner/barcode-scanner";
import { ScanResult } from "@/components/scanner/scan-result";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScanTitleSearch } from "@/components/scanner/scan-title-search";
import { extractIsbnFromBarcode } from "@/lib/books/isbn";
import { OfflineGuard } from "@/components/offline/offline-guard";

import { usePreferences } from "@/lib/preferences";

export default function ScanPage() {
  const { preferences } = usePreferences();
  const router = useRouter();
  const lookupLock = useRef(false);
  const [manualIsbn, setManualIsbn] = useState('');
  const [manualError, setManualError] = useState('');
  const [scannedCode, setScannedCode] = useState('');
  const [titleSearch, setTitleSearch] = useState(false);
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingBookId, setExistingBookId] = useState<string | null>(null);

  const handleScan = async (code: string) => {
    if (lookupLock.current) return;
    lookupLock.current = true;
    setScannedCode(code); setManualError(''); setTitleSearch(false); setResult(null);
    setLoading(true);
    setError(null);
    setExistingBookId(null);
    setActive(false);

    try {
      const response = await fetch(`/api/lookup/isbn/${encodeURIComponent(code)}`);
      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Lookup failed");
        setResult(null);
        return;
      }

      if (data.owned && data.normalizedIsbn) {
        const checkResponse = await fetch(
          `/api/library/check?isbn=${encodeURIComponent(data.normalizedIsbn)}`
        );
        if (checkResponse.ok) {
          const checkData = await checkResponse.json();
          setExistingBookId(checkData.bookId || null);
        }
      }

      setResult(data);
    } catch {
      setError("Network error");
      setResult(null);
    } finally {
      lookupLock.current = false;
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!result?.metadata) return;

    const payload = {
      title: result.metadata.title,
      authorName: result.metadata.authors?.join(" & ") || "Unknown",
      isbn13: result.normalizedIsbn,
      publisher: result.metadata.publisher || null,
      publicationYear: result.metadata.publishedYear || null,
      coverUrl: result.metadata.coverUrl || null,
      coverLocked: !!result.corrected,
      seriesName: result.metadata.seriesName || null,
      seriesNumber: result.metadata.seriesNumber || null,
      tags: [],
      genres: result.metadata.subjects?.slice(0, 10) || [],
      source: "SCAN",
    };

    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Auto-Covers": preferences.autoCovers && !result.corrected ? "on" : "off" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (response.ok) {
      router.push(`/library/book/${data.book.id}`);
      return;
    }

    if (data.error_code === "DUPLICATE_ISBN" && data.details?.existingBookId) {
      router.push(`/library/book/${data.details.existingBookId}`);
      return;
    }

    setError(data.message || "Failed to add book");
  };

  const handleScanAgain = () => {
    setResult(null);
    setError(null);
    setExistingBookId(null);
    setTitleSearch(false); setScannedCode('');
    setActive(true);
  };

  const handleViewBook = (bookId?: string) => {
    if (bookId) {
      router.push(`/library/book/${bookId}`);
    }
  };

  return (
    <OfflineGuard action="scan and add books">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Scan a book</h1>
          <p className="text-gray-600">Point your camera at a barcode</p>
        </div>
        <BarcodeScanner onScan={handleScan} active={active} />
        {active && <form className="space-y-3 border rounded-lg p-4" onSubmit={event => {
          event.preventDefault(); const isbn = extractIsbnFromBarcode(manualIsbn);
          if (!isbn) { setManualError('Enter a valid ISBN-10 or ISBN-13, not a retail UPC or price code.'); return; }
          void handleScan(isbn);
        }}>
          <Input label="Printed ISBN" placeholder="ISBN-10 or ISBN-13; hyphens are fine" value={manualIsbn} onChange={event => setManualIsbn(event.target.value)} required />
          {manualError && <p role="alert" className="text-sm text-red-600">{manualError}</p>}
          <Button type="submit" disabled={loading}>Look up ISBN</Button>
          <p className="text-sm text-gray-500">Some paperbacks have a retail barcode outside and an ISBN barcode inside the front cover.</p>
        </form>}
        {scannedCode && <p className="text-sm text-gray-500">ISBN submitted: <span className="font-mono">{scannedCode}</span></p>}
        {!loading && <div className="space-y-3">
          <Button type="button" variant="secondary" onClick={() => { setActive(false); setTitleSearch(true); }}>Wrong book or no ISBN? Search by title</Button>
          {titleSearch && <Button type="button" variant="ghost" onClick={handleScanAgain}>Return to camera</Button>}
          {titleSearch && <ScanTitleSearch printedIsbn={scannedCode} onSelect={(book, keepIsbn) => {
            setResult({ isIsbn: true, normalizedIsbn: keepIsbn ? scannedCode : null, owned: false, corrected: true, metadata: { title: book.title, authors: book.authors, coverUrl: book.coverUrl } });
            setError(null); setExistingBookId(null); setTitleSearch(false); setActive(false);
          }} />}
        </div>}
        {result?.corrected && <p role="status" className="text-sm text-amber-700 dark:text-amber-300">Title selected manually. Publication year and other edition details have not been verified.{!result.normalizedIsbn && ' No ISBN will be attached.'}</p>}
        {!titleSearch && <ScanResult
          loading={loading}
          result={result}
          error={error}
          onAdd={handleAdd}
          onViewBook={handleViewBook}
          onScanAgain={handleScanAgain}
          existingBookId={existingBookId}
        />}
      </div>
    </OfflineGuard>
  );
}
