"use client";

import { useState } from "react";
import { copyCompletionsToChild } from "@/lib/actions/completions";

interface Mismatch {
  source_child_id: string;
  source_child_name: string;
  source_completed_count: number;
  target_child_id: string;
  target_child_name: string;
  target_completed_count: number;
  missing_count: number;
}

export default function CompletionCopyBanner({
  curriculumId,
  mismatches,
}: {
  curriculumId: string;
  mismatches: Mismatch[];
}) {
  const [copied, setCopied] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (mismatches.length === 0) return null;

  const visibleMismatches = mismatches.filter(
    (m) => !copied[`${m.source_child_id}-${m.target_child_id}`]
  );

  if (visibleMismatches.length === 0) return null;

  async function handleCopy(m: Mismatch) {
    const key = `${m.source_child_id}-${m.target_child_id}`;
    setLoading(key);
    setError(null);

    const result = await copyCompletionsToChild(
      curriculumId,
      m.source_child_id,
      m.target_child_id
    );

    setLoading(null);

    if (result.error) {
      setError(result.error);
    } else {
      setCopied((prev) => ({ ...prev, [key]: result.copied ?? 0 }));
    }
  }

  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-950/30">
      {error && (
        <p className="mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
      {visibleMismatches.map((m) => {
        const key = `${m.source_child_id}-${m.target_child_id}`;
        const isLoading = loading === key;
        return (
          <div
            key={key}
            className="flex flex-wrap items-center justify-between gap-2"
          >
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>{m.source_child_name}</strong> has {m.missing_count}{" "}
              completed lesson{m.missing_count !== 1 ? "s" : ""} that{" "}
              <strong>{m.target_child_name}</strong> doesn&apos;t.
            </p>
            <button
              onClick={() => handleCopy(m)}
              disabled={isLoading}
              className="rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isLoading
                ? "Copying..."
                : `Copy to ${m.target_child_name}`}
            </button>
          </div>
        );
      })}
    </div>
  );
}
