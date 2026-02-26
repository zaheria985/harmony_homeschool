"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { bulkImportResources } from "@/lib/actions/resources";

export default function BulkResourceImportModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    imported?: number;
    skipped?: number;
    error?: string;
  } | null>(null);

  function handleClose() {
    setText("");
    setResult(null);
    onClose();
  }

  async function handleImport() {
    setSubmitting(true);
    setResult(null);

    const formData = new FormData();
    formData.set("text", text);

    const res = await bulkImportResources(formData);

    if (res.error) {
      setResult({ error: res.error });
    } else {
      setResult({
        imported: (res as { imported: number; skipped: number }).imported,
        skipped: (res as { imported: number; skipped: number }).skipped,
      });
      setText("");
    }
    setSubmitting(false);
  }

  return (
    <Modal open={open} onClose={handleClose} title="Bulk Import Resources">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-sm text-muted">
            Paste one resource per line. Format:{" "}
            <code className="rounded bg-surface-subtle px-1 py-0.5 text-xs">
              Title | Type | URL
            </code>
          </p>
          <p className="mb-3 text-xs text-tertiary">
            Supported types: book, video, pdf, link, supply. Pipe (|) or
            comma-separated. Duplicates (same title + URL) are skipped.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
            rows={10}
            placeholder={`Math Workbook | book | https://example.com/math
Science Video | video | https://youtube.com/watch?v=...
Art Supplies | supply`}
          />
        </div>

        {result?.error && (
          <p className="text-sm text-red-600">{result.error}</p>
        )}

        {result && !result.error && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
            Imported {result.imported} resource
            {result.imported !== 1 ? "s" : ""}
            {result.skipped
              ? `, skipped ${result.skipped} duplicate${result.skipped !== 1 ? "s" : ""}`
              : ""}
            .
          </div>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
          >
            {result && !result.error ? "Done" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={submitting || !text.trim()}
            className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
          >
            {submitting ? "Importing..." : "Import"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
