"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { shiftLessons } from "@/lib/actions/schedule";

/**
 * "Sick week" control: push incomplete lessons forward by N school days when
 * the family loses days to illness, travel, or a bad week.
 */
export default function ShiftLessonsButton({
  weekStart,
  childrenList,
}: {
  weekStart: string;
  childrenList: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [childId, setChildId] = useState<string>("all");
  const [fromDate, setFromDate] = useState(weekStart);
  const [schoolDays, setSchoolDays] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<number | null>(null);

  function reset() {
    setError(null);
    setResult(null);
    setSchoolDays(5);
    setFromDate(weekStart);
  }

  async function handleShift(days: number) {
    setSaving(true);
    setError(null);
    const response = await shiftLessons(
      childId === "all" ? null : childId,
      fromDate,
      days,
    );
    setSaving(false);

    if (response && "error" in response) {
      setError(response.error ?? "Something went wrong");
      return;
    }
    setResult(response?.shifted ?? 0);
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-lg border border-light px-3 py-1.5 text-xs font-medium text-secondary hover:border-interactive-border hover:text-interactive"
      >
        Shift lessons…
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Shift lessons forward"
      >
        {result !== null ? (
          <div className="space-y-4">
            <p className="text-sm text-primary">
              {result === 0
                ? "No incomplete lessons needed moving."
                : `Moved ${result} lesson${result === 1 ? "" : "s"} forward.`}
            </p>
            {result > 0 && (
              <p className="text-xs text-muted">
                Undo steps the same lessons back by {schoolDays} school day
                {schoolDays === 1 ? "" : "s"}. It re-runs the shift in reverse
                rather than restoring a snapshot, so do it before making other
                schedule changes.
              </p>
            )}
            <div className="flex justify-end gap-2">
              {result > 0 && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => handleShift(-schoolDays)}
                  className="rounded-lg border border-light px-3 py-2 text-sm text-secondary hover:text-interactive disabled:opacity-50"
                >
                  Undo
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg bg-interactive px-3 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Pushes <strong>incomplete</strong> lessons on or after the chosen
              date forward, skipping non-school days. Completed work is left
              where it is.
            </p>

            {childrenList.length > 1 && (
              <div>
                <label
                  htmlFor="shift-child"
                  className="block text-sm font-medium text-secondary"
                >
                  Student
                </label>
                <select
                  id="shift-child"
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
                >
                  <option value="all">All students</option>
                  {childrenList.map((child) => (
                    <option key={child.id} value={child.id}>
                      {child.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label
                htmlFor="shift-from"
                className="block text-sm font-medium text-secondary"
              >
                Starting from
              </label>
              <input
                id="shift-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
              />
            </div>

            <div>
              <label
                htmlFor="shift-days"
                className="block text-sm font-medium text-secondary"
              >
                Move forward by (school days)
              </label>
              <input
                id="shift-days"
                type="number"
                min={1}
                max={60}
                value={schoolDays}
                onChange={(e) =>
                  setSchoolDays(Math.max(1, Number(e.target.value) || 1))
                }
                className="mt-1 w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary"
              />
            </div>

            {error && (
              <p className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg border border-light px-3 py-2 text-sm text-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => handleShift(schoolDays)}
                className="rounded-lg bg-interactive px-3 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
              >
                {saving ? "Shifting…" : "Shift lessons"}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
