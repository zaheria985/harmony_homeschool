"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import { archiveCompletedLessons, unarchiveLessons } from "@/lib/actions/lessons";

interface YearStats {
  year_id: string;
  year_label: string;
  archivable_count: number;
  archived_count: number;
}

interface LessonArchiveCardProps {
  archivableCount: number;
  archivedCount: number;
  byYear: YearStats[];
}

export default function LessonArchiveCard({
  archivableCount,
  archivedCount,
  byYear,
}: LessonArchiveCardProps) {
  const [selectedYear, setSelectedYear] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleArchive() {
    setLoading(true);
    setFeedback(null);
    const fd = new FormData();
    if (selectedYear) fd.set("yearId", selectedYear);
    const result = await archiveCompletedLessons(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFeedback({ type: "error", message: result.error });
    } else if ("archivedCount" in result) {
      setFeedback({
        type: "success",
        message: `Archived ${result.archivedCount} completed lesson${result.archivedCount !== 1 ? "s" : ""}.`,
      });
    }
  }

  async function handleUnarchive() {
    if (!selectedYear) return;
    setLoading(true);
    setFeedback(null);
    const fd = new FormData();
    fd.set("yearId", selectedYear);
    const result = await unarchiveLessons(fd);
    setLoading(false);
    if ("error" in result && result.error) {
      setFeedback({ type: "error", message: result.error });
    } else {
      setFeedback({ type: "success", message: "Lessons unarchived successfully." });
    }
  }

  const selectedStats = selectedYear
    ? byYear.find((y) => y.year_id === selectedYear)
    : null;
  const displayArchivable = selectedStats
    ? selectedStats.archivable_count
    : archivableCount;
  const displayArchived = selectedStats
    ? selectedStats.archived_count
    : archivedCount;

  return (
    <Card>
      <div className="flex items-center gap-3">
        <span className="text-2xl">📦</span>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">Lesson Archiving</h3>
          <p className="text-sm text-muted">
            Archive completed lessons to reduce clutter while preserving records
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <div className="rounded-lg border border-light bg-surface-muted px-3 py-2">
          <span className="font-medium">{displayArchivable}</span>{" "}
          <span className="text-muted">ready to archive</span>
        </div>
        <div className="rounded-lg border border-light bg-surface-muted px-3 py-2">
          <span className="font-medium">{displayArchived}</span>{" "}
          <span className="text-muted">archived</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label
            htmlFor="archive-year"
            className="mb-1 block text-xs font-medium text-muted"
          >
            School Year (optional)
          </label>
          <select
            id="archive-year"
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setFeedback(null);
            }}
            className="rounded-lg border border-light bg-surface px-3 py-1.5 text-sm"
          >
            <option value="">All years</option>
            {byYear.map((y) => (
              <option key={y.year_id} value={y.year_id}>
                {y.year_label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleArchive}
          disabled={loading || displayArchivable === 0}
          className="rounded-lg bg-interactive px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Archiving..." : "Archive Completed Lessons"}
        </button>

        {selectedYear && displayArchived > 0 && (
          <button
            onClick={handleUnarchive}
            disabled={loading}
            className="rounded-lg border border-light bg-surface px-4 py-1.5 text-sm font-medium text-secondary hover:bg-surface-muted disabled:opacity-50"
          >
            Unarchive {displayArchived} Lesson{displayArchived !== 1 ? "s" : ""}
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`mt-3 rounded-lg px-3 py-2 text-sm ${
            feedback.type === "success"
              ? "border border-success-200 bg-success-50 text-success-700"
              : "border border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </Card>
  );
}
