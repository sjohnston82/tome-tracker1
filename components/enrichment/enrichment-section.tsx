"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

export function EnrichmentSection() {
  const [status, setStatus] = useState<{ needsEnrichment: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ enriched: number } | null>(null);

  useEffect(() => {
    fetch("/api/enrichment/status")
      .then((response) => response.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  const handleEnrich = async () => {
    setRunning(true);
    try {
      const response = await fetch("/api/enrichment/trigger", { method: "POST" });
      const data = await response.json();
      setResult(data.result);

      const statusResponse = await fetch("/api/enrichment/status");
      setStatus(await statusResponse.json());
    } finally {
      setRunning(false);
    }
  };

  if (!status || status.needsEnrichment === 0) return null;

  return (
    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
      <p className="text-sm text-blue-800 dark:text-blue-200">
        {status.needsEnrichment} books may have missing metadata
      </p>
      <Button size="sm" onClick={handleEnrich} loading={running} className="mt-2">
        Enrich metadata
      </Button>
      {result && (
        <p className="text-sm text-blue-600 mt-2">
          Updated {result.enriched} books
        </p>
      )}
    </div>
  );
}
