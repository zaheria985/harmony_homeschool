"use client";

import { useState, useTransition } from "react";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import { addReadingEntry, deleteReadingEntry } from "@/lib/actions/reading";
import { BookOpen, Plus, Trash2, X } from "lucide-react";

interface ReadingEntry {
  id: string;
  resource_id: string;
  child_id: string;
  date: string;
  pages_read: number | null;
  minutes_read: number | null;
  notes: string | null;
  created_at: string;
  resource_title: string;
  resource_author: string | null;
  resource_thumbnail: string | null;
  child_name: string;
  child_emoji: string | null;
}

interface BookResource {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
}

interface Child {
  id: string;
  name: string;
  emoji: string | null;
}

interface ReadingStats {
  books_read: number;
  total_pages: number;
  total_minutes: number;
  total_entries: number;
}

export default function ReadingLogClient({
  entries,
  books,
  children,
  stats,
}: {
  entries: ReadingEntry[];
  books: BookResource[];
  children: Child[];
  stats: ReadingStats;
}) {
  const [showForm, setShowForm] = useState(false);
  const [filterChild, setFilterChild] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const filteredEntries = filterChild
    ? entries.filter((e) => e.child_id === filterChild)
    : entries;

  // Group entries by date
  const groupedEntries = filteredEntries.reduce<
    Record<string, ReadingEntry[]>
  >((groups, entry) => {
    const date = entry.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(entry);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedEntries).sort(
    (a, b) => b.localeCompare(a)
  );

  function formatDate(dateStr: string) {
    const [year, month, day] = dateStr.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function handleSubmit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await addReadingEntry(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setShowForm(false);
      }
    });
  }

  function handleDelete(entryId: string) {
    if (!confirm("Delete this reading entry?")) return;
    startTransition(async () => {
      await deleteReadingEntry(entryId);
    });
  }

  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Books Read" value={stats.books_read} color="primary" />
        <StatCard
          label="Total Pages"
          value={stats.total_pages.toLocaleString()}
          color="success"
        />
        <StatCard
          label="Total Minutes"
          value={stats.total_minutes.toLocaleString()}
          color="warning"
        />
        <StatCard label="Log Entries" value={stats.total_entries} />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-muted">Filter:</label>
          <select
            value={filterChild}
            onChange={(e) => setFilterChild(e.target.value)}
            className="rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
          >
            <option value="">All Children</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji ? `${c.emoji} ` : ""}
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-interactive/90"
        >
          {showForm ? (
            <>
              <X size={16} />
              Cancel
            </>
          ) : (
            <>
              <Plus size={16} />
              Log Reading
            </>
          )}
        </button>
      </div>

      {/* Add entry form */}
      {showForm && (
        <Card title="Log Reading Session">
          <form action={handleSubmit} className="space-y-4">
            {error && (
              <p className="rounded-lg bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)]">
                {error}
              </p>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-primary">
                  Child <span className="text-[var(--error-text)]">*</span>
                </label>
                <select
                  name="childId"
                  required
                  className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
                >
                  <option value="">Select child...</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.emoji ? `${c.emoji} ` : ""}
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-primary">
                  Book <span className="text-[var(--error-text)]">*</span>
                </label>
                <select
                  name="resourceId"
                  required
                  className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
                >
                  <option value="">Select book...</option>
                  {books.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.title}
                      {b.author ? ` — ${b.author}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-primary">
                  Date <span className="text-[var(--error-text)]">*</span>
                </label>
                <input
                  type="date"
                  name="date"
                  defaultValue={today}
                  required
                  className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">
                    Pages
                  </label>
                  <input
                    type="number"
                    name="pagesRead"
                    min="0"
                    placeholder="0"
                    className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-primary">
                    Minutes
                  </label>
                  <input
                    type="number"
                    name="minutesRead"
                    min="0"
                    placeholder="0"
                    className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-primary">
                Notes
              </label>
              <textarea
                name="notes"
                rows={2}
                placeholder="What did they read about today?"
                className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-interactive/90 disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Entry"}
              </button>
            </div>
          </form>
        </Card>
      )}

      {/* Reading log entries grouped by date */}
      {sortedDates.length === 0 ? (
        <EmptyState
          message="No reading entries yet. Log your first reading session!"
          icon={<BookOpen size={28} className="text-muted" />}
        />
      ) : (
        <div className="space-y-6">
          {sortedDates.map((date) => (
            <div key={date}>
              <h3 className="mb-3 text-sm font-semibold text-muted">
                {formatDate(date)}
              </h3>
              <div className="space-y-2">
                {groupedEntries[date].map((entry) => (
                  <Card key={entry.id} className="!p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        {entry.resource_thumbnail ? (
                          <img
                            src={entry.resource_thumbnail}
                            alt=""
                            className="h-12 w-9 rounded object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-9 items-center justify-center rounded bg-[var(--bg-tertiary)]">
                            <BookOpen
                              size={16}
                              className="text-muted"
                            />
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-medium text-primary">
                            {entry.resource_title}
                          </p>
                          {entry.resource_author && (
                            <p className="text-xs text-muted">
                              by {entry.resource_author}
                            </p>
                          )}
                          <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                            <span>
                              {entry.child_emoji || ""} {entry.child_name}
                            </span>
                            {entry.pages_read != null && (
                              <span>{entry.pages_read} pages</span>
                            )}
                            {entry.minutes_read != null && (
                              <span>{entry.minutes_read} min</span>
                            )}
                          </div>
                          {entry.notes && (
                            <p className="mt-1 text-xs text-muted italic">
                              {entry.notes}
                            </p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        disabled={isPending}
                        className="rounded p-1 text-muted transition-colors hover:bg-[var(--bg-tertiary)] hover:text-[var(--error-text)]"
                        title="Delete entry"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
