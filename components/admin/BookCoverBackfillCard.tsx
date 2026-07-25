"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import { backfillBookCovers } from "@/lib/actions/resources";

type Result = {
  found: number;
  missed: number;
  total: number;
  missedSample?: string[];
};

/**
 * Fills in cover art for books that have none — mostly the ones imported in
 * bulk before every creation path looked a cover up.
 *
 * The run is deliberately slow (about a book per second, OpenLibrary's ask),
 * so the button warns rather than pretending it is instant.
 */
export default function BookCoverBackfillCard({
  missingCount,
}: {
  missingCount: number;
}) {
  const router = useRouter();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");

  const estimatedSeconds = Math.ceil(missingCount * 1.1);
  const estimate =
    estimatedSeconds >= 60
      ? `about ${Math.ceil(estimatedSeconds / 60)} min`
      : `about ${estimatedSeconds}s`;

  async function handleRun() {
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const response = await backfillBookCovers();
      if ("error" in response && response.error) {
        setError(response.error);
        return;
      }
      if ("found" in response) {
        setResult({
          found: response.found ?? 0,
          missed: response.missed ?? 0,
          total: response.total ?? 0,
          missedSample: response.missedSample ?? [],
        });
        router.refresh();
      }
    } catch {
      setError("The backfill stopped unexpectedly. Check the server logs.");
    } finally {
      setRunning(false);
    }
  }

  return (
    <Card>
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          🖼️
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">Book covers</h3>
          {missingCount === 0 ? (
            <p className="text-sm text-muted">
              Every book has cover art.
            </p>
          ) : (
            <p className="text-sm text-muted">
              {missingCount} {missingCount === 1 ? "book has" : "books have"} no
              cover. Fetching them takes {estimate} — one lookup a second, which
              is what OpenLibrary asks for.
            </p>
          )}

          {missingCount > 0 && (
            <button
              type="button"
              onClick={handleRun}
              disabled={running}
              className="mt-3 min-h-[40px] rounded-xl bg-[var(--interactive)] px-4 text-sm font-medium text-[var(--brand-contrast)] transition-colors hover:bg-[var(--interactive-hover)] disabled:opacity-60"
            >
              {running ? "Fetching covers…" : "Fetch missing covers"}
            </button>
          )}

          {running && (
            <p className="mt-2 text-xs text-tertiary">
              Leave this page open until it finishes.
            </p>
          )}

          {result && (
            <div className="mt-3 rounded-xl border border-light bg-surface-muted p-3 text-sm">
              <p className="text-primary">
                Found {result.found} of {result.total}.
                {result.missed > 0 && ` ${result.missed} still have none.`}
              </p>
              {result.missedSample && result.missedSample.length > 0 && (
                <p className="mt-1 text-xs text-muted">
                  No match for: {result.missedSample.join(", ")}
                  {result.missed > result.missedSample.length && " and others"}.
                  Check the author spelling, then use Refresh cover on the book.
                </p>
              )}
            </div>
          )}

          {error && (
            <p
              role="alert"
              className="mt-3 text-sm font-medium text-[var(--error-text)]"
            >
              {error}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
