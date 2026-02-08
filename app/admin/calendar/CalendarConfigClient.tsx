"use client";

import { useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import {
  createSchoolYear,
  updateSchoolYear,
  deleteSchoolYear,
  setSchoolDays,
  addDateOverride,
  removeDateOverride,
} from "@/lib/actions/calendar";

type DateOverride = {
  id: string;
  date: string;
  type: "exclude" | "include";
  reason: string | null;
};

type SchoolYear = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  lesson_count: number;
  weekdays: number[];
  overrides: DateOverride[];
};

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarConfigClient({
  schoolYears,
}: {
  schoolYears: SchoolYear[];
}) {
  const [showNewYear, setShowNewYear] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleCreateYear(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createSchoolYear(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setShowNewYear(false);
      }
    });
  }

  function handleDeleteYear(id: string) {
    if (!confirm("Delete this school year? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteSchoolYear(id);
    });
  }

  function handleUpdateYear(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await updateSchoolYear(formData);
      if (result.error) setError(result.error);
    });
  }

  function handleToggleWeekday(yearId: string, currentDays: number[], day: number) {
    const next = currentDays.includes(day)
      ? currentDays.filter((d) => d !== day)
      : [...currentDays, day].sort();
    startTransition(async () => {
      await setSchoolDays(yearId, next);
    });
  }

  function handleAddOverride(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await addDateOverride(formData);
      if (result.error) setError(result.error);
    });
  }

  function handleRemoveOverride(id: string) {
    startTransition(async () => {
      await removeDateOverride(id);
    });
  }

  return (
    <div className="space-y-8">
      {/* Create new school year */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">School Years</h2>
        <button
          onClick={() => setShowNewYear(!showNewYear)}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
        >
          {showNewYear ? "Cancel" : "New School Year"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {showNewYear && (
        <Card>
          <form action={handleCreateYear} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Label
              </label>
              <input
                name="label"
                placeholder="e.g. 2025-2026"
                required
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Start Date
                </label>
                <input
                  name="start_date"
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  End Date
                </label>
                <input
                  name="end_date"
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create School Year"}
            </button>
          </form>
        </Card>
      )}

      {/* Existing school years */}
      {schoolYears.length === 0 ? (
        <Card>
          <p className="text-center text-sm text-gray-500">
            No school years configured. Create one to get started.
          </p>
        </Card>
      ) : (
        schoolYears.map((year) => (
          <SchoolYearCard
            key={year.id}
            year={year}
            isPending={isPending}
            onToggleWeekday={handleToggleWeekday}
            onUpdateYear={handleUpdateYear}
            onAddOverride={handleAddOverride}
            onRemoveOverride={handleRemoveOverride}
            onDelete={handleDeleteYear}
          />
        ))
      )}
    </div>
  );
}

function SchoolYearCard({
  year,
  isPending,
  onToggleWeekday,
  onUpdateYear,
  onAddOverride,
  onRemoveOverride,
  onDelete,
}: {
  year: SchoolYear;
  isPending: boolean;
  onToggleWeekday: (yearId: string, currentDays: number[], day: number) => void;
  onUpdateYear: (formData: FormData) => void;
  onAddOverride: (formData: FormData) => void;
  onRemoveOverride: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [editingYear, setEditingYear] = useState(false);

  return (
    <Card>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="w-full">
          <h3 className="text-lg font-semibold">{year.label}</h3>
          <p className="text-sm text-gray-500">
            {new Date(year.start_date + "T00:00:00").toLocaleDateString()} &ndash;{" "}
            {new Date(year.end_date + "T00:00:00").toLocaleDateString()}
            <span className="ml-3 text-gray-400">
              {year.lesson_count} lesson{year.lesson_count !== 1 ? "s" : ""}
            </span>
          </p>
          {editingYear && (
            <form
              action={(formData) => {
                onUpdateYear(formData);
                setEditingYear(false);
              }}
              className="mt-3 grid grid-cols-1 gap-2 rounded-lg border bg-gray-50 p-3 sm:grid-cols-4"
            >
              <input type="hidden" name="id" value={year.id} />
              <input
                name="label"
                defaultValue={year.label}
                required
                className="rounded border px-2 py-1 text-sm"
              />
              <input
                name="start_date"
                type="date"
                defaultValue={year.start_date}
                required
                className="rounded border px-2 py-1 text-sm"
              />
              <input
                name="end_date"
                type="date"
                defaultValue={year.end_date}
                required
                className="rounded border px-2 py-1 text-sm"
              />
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-primary-600 px-3 py-1 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => setEditingYear(false)}
                  className="rounded border px-3 py-1 text-xs text-gray-600 hover:bg-gray-100"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
        <div className="ml-3 flex shrink-0 gap-2">
          <button
            onClick={() => setEditingYear((v) => !v)}
            className="rounded-lg border px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
          >
            {editingYear ? "Close" : "Edit Dates"}
          </button>
          <button
            onClick={() => onDelete(year.id)}
            className="rounded-lg border border-red-200 px-2.5 py-1 text-xs text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        </div>
      </div>

      {/* School days */}
      <div className="mb-5">
        <h4 className="mb-2 text-sm font-semibold text-gray-500 uppercase tracking-wider">
          School Days
        </h4>
        <div className="flex gap-2">
          {WEEKDAY_LABELS.map((label, i) => {
            const active = year.weekdays.includes(i);
            return (
              <button
                key={i}
                onClick={() => onToggleWeekday(year.id, year.weekdays, i)}
                disabled={isPending}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-primary-100 text-primary-700 ring-1 ring-primary-300"
                    : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                } disabled:opacity-50`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Date overrides */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
            Date Overrides
          </h4>
          <button
            onClick={() => setShowAddOverride(!showAddOverride)}
            className="text-xs font-medium text-primary-600 hover:text-primary-700"
          >
            {showAddOverride ? "Cancel" : "+ Add Override"}
          </button>
        </div>

        {showAddOverride && (
          <form
            action={(formData) => {
              onAddOverride(formData);
              setShowAddOverride(false);
            }}
            className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
          >
            <input type="hidden" name="school_year_id" value={year.id} />
            <div>
              <label className="block text-xs font-medium text-gray-600">Date</label>
              <input
                name="date"
                type="date"
                required
                className="mt-0.5 rounded border px-2 py-1 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">Type</label>
              <select
                name="type"
                className="mt-0.5 rounded border px-2 py-1 text-sm"
              >
                <option value="exclude">Day Off (exclude)</option>
                <option value="include">Make-up Day (include)</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600">Reason</label>
              <input
                name="reason"
                placeholder="e.g. Thanksgiving"
                className="mt-0.5 w-full rounded border px-2 py-1 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-primary-600 px-3 py-1 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              Add
            </button>
          </form>
        )}

        {year.overrides.length === 0 ? (
          <p className="text-sm text-gray-400">No overrides set.</p>
        ) : (
          <div className="space-y-1">
            {year.overrides.map((ov) => (
              <div
                key={ov.id}
                className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${
                      ov.type === "exclude"
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {ov.type === "exclude" ? "Off" : "On"}
                  </span>
                  <span className="font-medium">
                    {new Date(ov.date + "T00:00:00").toLocaleDateString()}
                  </span>
                  {ov.reason && (
                    <span className="text-gray-500">{ov.reason}</span>
                  )}
                </div>
                <button
                  onClick={() => onRemoveOverride(ov.id)}
                  disabled={isPending}
                  className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
