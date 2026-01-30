"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarcodeScanner } from "@/components/scanner/barcode-scanner";
import { ScanResult } from "@/components/scanner/scan-result";

export default function ScanPage() {
  const router = useRouter();
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingBookId, setExistingBookId] = useState<string | null>(null);

  const handleScan = async (code: string) => {
    if (loading) return;
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
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!result?.metadata) return;

    const payload = {
      title: result.metadata.title,
      authorName: result.metadata.authors?.[0] || "Unknown",
      isbn13: result.normalizedIsbn,
      publisher: result.metadata.publisher || null,
      publicationYear: result.metadata.publishedYear || null,
      coverUrl: result.metadata.coverUrl || null,
      seriesName: result.metadata.seriesName || null,
      seriesNumber: result.metadata.seriesNumber || null,
      tags: [],
      genres: result.metadata.subjects?.slice(0, 10) || [],
      source: "SCAN",
    };

    const response = await fetch("/api/books", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    setActive(true);
  };

  const handleViewBook = (bookId?: string) => {
    if (bookId) {
      router.push(`/library/book/${bookId}`);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scan a book</h1>
        <p className="text-gray-600">Point your camera at a barcode</p>
      </div>
      <BarcodeScanner onScan={handleScan} active={active} />
      <ScanResult
        loading={loading}
        result={result}
        error={error}
        onAdd={handleAdd}
        onViewBook={handleViewBook}
        onScanAgain={handleScanAgain}
        existingBookId={existingBookId}
      />
    </div>
  );
}
