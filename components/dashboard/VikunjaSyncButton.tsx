"use client";

import { useState } from "react";
import { syncToVikunja } from "@/lib/actions/vikunja-sync";

export default function VikunjaSyncButton() {
  const [syncing, setSyncing] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  async function handleSync() {
    setSyncing(true);
    setResult(null);
    try {
      const res = await syncToVikunja();
      if (res.success) {
        setResult(`Synced: ${res.created} created, ${res.deleted} cleaned up, ${res.skipped} unchanged`);
      } else {
        setResult(`Error: ${res.error}`);
      }
    } catch {
      setResult("Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleSync}
        disabled={syncing}
        className="rounded-lg bg-interactive px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-interactive-hover disabled:opacity-50"
      >
        {syncing ? "Syncing..." : "Sync to Vikunja"}
      </button>
      {result && (
        <span className="text-xs text-muted">{result}</span>
      )}
    </div>
  );
}
