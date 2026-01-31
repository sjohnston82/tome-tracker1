"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type ImportStep = "upload" | "mapping" | "importing" | "complete";

interface Preview {
  format: string;
  totalRows: number;
  columns: string[];
  suggestedMapping: Record<string, string | null>;
  sampleRows: Record<string, string>[];
}

interface ImportResult {
  imported: number;
  duplicates: number;
  errors: Array<{ row: number; error: string }>;
}

export default function ImportPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch("/api/import/preview", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Failed to parse file");
      }

      const data = await response.json();
      setPreview(data.preview);
      setMapping(data.preview.suggestedMapping);
      setStep("mapping");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse file");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file || !preview) return;

    setLoading(true);
    setStep("importing");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));
      formData.append("format", preview.format);

      const response = await fetch("/api/import/execute", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || "Import failed");
      }

      const data = await response.json();
      setResult(data.result);
      setStep("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setStep("mapping");
    } finally {
      setLoading(false);
    }
  };

  if (step === "upload") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Import Books</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center border-2 border-dashed border-gray-300 dark:border-gray-600">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="hidden"
          />

          <div className="text-4xl mb-4">📁</div>

          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Upload a CSV file from Goodreads, StoryGraph, or your own spreadsheet
          </p>

          <Button onClick={() => fileInputRef.current?.click()} loading={loading}>
            Select CSV file
          </Button>

          {error && <p className="text-red-600 mt-4">{error}</p>}
        </div>

        <div className="mt-6 text-sm text-gray-500 space-y-2">
          <p>
            <strong>Supported formats:</strong>
          </p>
          <ul className="list-disc ml-6">
            <li>Goodreads export (My Books → Export)</li>
            <li>StoryGraph export</li>
            <li>Custom CSV with Title and Author columns</li>
          </ul>
        </div>
      </div>
    );
  }

  if (step === "mapping" && preview) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Import Books</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div>
              <p className="font-medium">{file?.name}</p>
              <p className="text-sm text-gray-500">
                {preview.totalRows} rows • {preview.format} format detected
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("upload");
                setFile(null);
                setPreview(null);
              }}
            >
              Change file
            </Button>
          </div>

          <h3 className="font-medium mb-3">Column Mapping</h3>

          <div className="space-y-3">
            {[
              "title",
              "author",
              "isbn",
              "seriesName",
              "publisher",
              "publicationYear",
            ].map((field) => (
              <div key={field} className="flex items-center gap-4">
                <label className="w-32 text-sm text-gray-600 capitalize">
                  {field.replace(/([A-Z])/g, " $1")}
                  {(field === "title" || field === "author") && " *"}
                </label>
                <select
                  value={mapping[field] || ""}
                  onChange={(event) =>
                    setMapping((current) => ({
                      ...current,
                      [field]: event.target.value || null,
                    }))
                  }
                  className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 px-3 py-2 bg-white dark:bg-gray-800"
                >
                  <option value="">-- Not mapped --</option>
                  {preview.columns.map((column) => (
                    <option key={column} value={column}>
                      {column}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <h3 className="font-medium mb-3">Preview</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b dark:border-gray-700">
                  <th className="text-left py-2">Title</th>
                  <th className="text-left py-2">Author</th>
                </tr>
              </thead>
              <tbody>
                {preview.sampleRows.slice(0, 3).map((row, index) => (
                  <tr key={index} className="border-b dark:border-gray-700">
                    <td className="py-2">
                      {mapping.title ? row[mapping.title] : "-"}
                    </td>
                    <td className="py-2">
                      {mapping.author ? row[mapping.author] : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 text-red-600 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        <div className="flex gap-4">
          <Button
            onClick={handleImport}
            disabled={!mapping.title || !mapping.author}
            className="flex-1"
          >
            Import {preview.totalRows} books
          </Button>
          <Button variant="secondary" onClick={() => router.push("/library")}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step === "importing") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Import Books</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 text-center">
          <div className="animate-spin text-4xl mb-4">📚</div>
          <p className="text-lg font-medium">Importing your books...</p>
          <p className="text-gray-500 mt-2">This may take a moment</p>
        </div>
      </div>
    );
  }

  if (step === "complete" && result) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Import Complete</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-2xl font-bold text-green-600">
                {result.imported}
              </p>
              <p className="text-sm text-green-700 dark:text-green-400">
                Imported
              </p>
            </div>
            <div className="text-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
              <p className="text-2xl font-bold text-yellow-600">
                {result.duplicates}
              </p>
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                Duplicates
              </p>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <p className="text-2xl font-bold text-red-600">
                {result.errors.length}
              </p>
              <p className="text-sm text-red-700 dark:text-red-400">Errors</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
                View errors
              </summary>
              <ul className="mt-2 space-y-1 text-red-600">
                {result.errors.slice(0, 10).map((err, index) => (
                  <li key={index}>
                    Row {err.row}: {err.error}
                  </li>
                ))}
                {result.errors.length > 10 && (
                  <li>...and {result.errors.length - 10} more</li>
                )}
              </ul>
            </details>
          )}
        </div>

        <Button onClick={() => router.push("/library")} className="w-full">
          Go to library
        </Button>
      </div>
    );
  }

  return null;
}
