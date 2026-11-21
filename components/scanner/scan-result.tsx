"use client";
import { Button } from '@/components/ui/button';
import { ScanLibraryReview } from './scan-library-review';
import type { BookMetadata } from '@/lib/metadata/types';
export function ScanResult({ loading, result, error, saving = false, onAdd, onViewBook, onScanAgain }: {
  loading: boolean; result: { isIsbn: boolean; normalizedIsbn: string | null; metadata: BookMetadata | null } | null;
  error: string | null; saving?: boolean; onAdd: () => void; onViewBook: (id: string) => void; onScanAgain: () => void;
}) {
  if (loading) return <p role="status">Looking up book details…</p>;
  if (!result) return error ? <div className="space-y-3"><p role="alert" className="text-red-600">{error}</p><Button onClick={onScanAgain}>Scan again</Button></div> : null;
  if (!result.isIsbn) return <div className="space-y-3"><p>This barcode is not a valid ISBN. Try the ISBN barcode inside the cover, or enter the printed ISBN.</p><Button onClick={onScanAgain}>Scan again</Button></div>;
  return <ScanLibraryReview isbn={result.normalizedIsbn} metadata={result.metadata} saving={saving} actionError={error} onAdd={onAdd} onViewBook={onViewBook} onScanAgain={onScanAgain} />;
}
