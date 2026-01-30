"use client";

import { Button } from "@/components/ui/button";

export function ScanResult({
  loading,
  result,
  error,
  onAdd,
  onViewBook,
  onScanAgain,
  existingBookId,
}: any) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
        <div className="animate-spin text-4xl mb-4">🔍</div>
        <p>Looking up...</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <Button onClick={onScanAgain}>Scan again</Button>
      </div>
    );
  }
  if (!result) return null;
  if (!result.isIsbn) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-yellow-600 mb-4">Not a book barcode</p>
        <Button onClick={onScanAgain}>Scan again</Button>
      </div>
    );
  }
  if (result.owned) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-green-600 text-lg mb-4">✓ You own this!</p>
        <div className="flex gap-3 justify-center">
          <Button onClick={() => onViewBook(existingBookId)}>View</Button>
          <Button variant="secondary" onClick={onScanAgain}>
            Scan another
          </Button>
        </div>
      </div>
    );
  }
  if (!result.metadata) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 text-center">
        <p className="text-yellow-600 mb-4">Not found in database</p>
        <Button onClick={onScanAgain}>Scan again</Button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden">
      <div className="p-6 flex gap-4">
        {result.metadata.coverUrl ? (
          <img
            src={result.metadata.coverUrl}
            className="w-24 h-36 object-cover rounded"
            alt={result.metadata.title}
          />
        ) : (
          <div className="w-24 h-36 bg-gray-200 rounded flex items-center justify-center text-3xl">
            📖
          </div>
        )}
        <div>
          <h3 className="font-bold text-lg">{result.metadata.title}</h3>
          <p className="text-gray-600">{result.metadata.authors.join(", ")}</p>
        </div>
      </div>
      <div className="px-6 pb-6 flex gap-3">
        <Button onClick={onAdd} className="flex-1">
          Add to library
        </Button>
        <Button variant="secondary" onClick={onScanAgain}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
