"use client";
import { useEffect, useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import {
  createSchoolYear,
  updateSchoolYear,
  deleteSchoolYear,
  setSchoolDays,
  addDateOverride,
  removeDateOverride,
} from "@/lib/actions/calendar";
import {
  hasWeekdayChanges,
  normalizeWeekdays,
} from "@/lib/utils/calendar-weekdays";
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
type ScheduleException = {
  assignment_id: string;
  curriculum_id: string;
  curriculum_name: string;
  child_id: string;
  child_name: string;
  school_year_id: string;
  school_year_label: string;
  configured_weekdays: number[];
  school_weekdays: number[];
};
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export default function CalendarConfigClient({
  schoolYears,
  scheduleExceptions,
}: {
  schoolYears: SchoolYear[];
  scheduleExceptions: ScheduleException[];
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
  function handleApplyWeekdays(yearId: string, weekdays: number[]) {
    startTransition(async () => {
      await setSchoolDays(yearId, weekdays);
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
    if (!confirm("Remove this date override?")) return;
    startTransition(async () => {
      await removeDateOverride(id);
    });
  }
  return (
    <div className="space-y-8">
      {" "}
      {/* Create new school year */}{" "}
      <div className="flex items-center justify-between">
        {" "}
        <h2 className="text-lg font-semibold text-primary">
          School Years
        </h2>{" "}
        <button
          onClick={() => setShowNewYear(!showNewYear)}
          className="rounded-lg bg-interactive px-3 py-1.5 text-sm font-medium text-white hover:bg-interactive-hover"
        >
          {" "}
          {showNewYear ? "Cancel" : "New School Year"}{" "}
        </button>{" "}
      </div>{" "}
      {error && (
        <div className="rounded-lg border border-[var(--error-border)] bg-[var(--error-bg)] p-3 text-sm text-red-700 dark:border-red-800/60/20 dark:text-red-300">
          {" "}
          {error}{" "}
        </div>
      )}{" "}
      {showNewYear && (
        <Card>
          {" "}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateYear(new FormData(event.currentTarget));
            }}
            className="space-y-4"
          >
            {" "}
            <div>
              {" "}
              <label className="block text-sm font-medium text-secondary">
                {" "}
                Label{" "}
              </label>{" "}
              <input
                name="label"
                placeholder="e.g. 2025-2026"
                required
                className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
              />{" "}
            </div>{" "}
            <div className="grid grid-cols-2 gap-4">
              {" "}
              <div>
                {" "}
                <label className="block text-sm font-medium text-secondary">
                  {" "}
                  Start Date{" "}
                </label>{" "}
                <input
                  name="start_date"
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
                />{" "}
              </div>{" "}
              <div>
                {" "}
                <label className="block text-sm font-medium text-secondary">
                  {" "}
                  End Date{" "}
                </label>{" "}
                <input
                  name="end_date"
                  type="date"
                  required
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
                />{" "}
              </div>{" "}
            </div>{" "}
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              {isPending ? "Creating..." : "Create School Year"}{" "}
            </button>{" "}
          </form>{" "}
        </Card>
      )}{" "}
      {/* Existing school years */}{" "}
      {schoolYears.length === 0 ? (
        <Card>
          {" "}
          <p className="text-center text-sm text-muted dark:text-slate-400">
            {" "}
            No school years configured. Create one to get started.{" "}
          </p>{" "}
        </Card>
      ) : (
        schoolYears.map((year) => (
          <SchoolYearCard
            key={year.id}
            year={year}
            isPending={isPending}
            onApplyWeekdays={handleApplyWeekdays}
            onUpdateYear={handleUpdateYear}
            onAddOverride={handleAddOverride}
            onRemoveOverride={handleRemoveOverride}
            onDelete={handleDeleteYear}
          />
        ))
      )}{" "}
      <Card>
        {" "}
        <h3 className="mb-3 text-lg font-semibold">Schedule Exceptions</h3>{" "}
        <p className="mb-4 text-sm text-muted dark:text-slate-400">
          {" "}
          Curricula with custom schedules that differ from school default
          days.{" "}
        </p>{" "}
        {scheduleExceptions.length === 0 ? (
          <p className="text-sm text-muted dark:text-slate-400">
            {" "}
            No schedule exceptions. All assignments follow school calendar
            defaults.{" "}
          </p>
        ) : (
          <div className="overflow-x-auto">
            {" "}
            <table className="w-full text-left text-sm">
              {" "}
              <thead>
                {" "}
                <tr className="border-b border-light text-muted dark:text-slate-400">
                  {" "}
                  <th className="pb-2 font-medium">Curriculum</th>{" "}
                  <th className="pb-2 font-medium">Student</th>{" "}
                  <th className="pb-2 font-medium">School Year</th>{" "}
                  <th className="pb-2 font-medium">Default Days</th>{" "}
                  <th className="pb-2 font-medium">Custom Days</th>{" "}
                </tr>{" "}
              </thead>{" "}
              <tbody>
                {" "}
                {scheduleExceptions.map((exception) => (
                  <tr
                    key={exception.assignment_id}
                    className="border-b border-light last:border-0"
                  >
                    {" "}
                    <td className="py-2 font-medium text-primary">
                      {exception.curriculum_name}
                    </td>{" "}
                    <td className="py-2 text-tertiary">
                      {exception.child_name}
                    </td>{" "}
                    <td className="py-2 text-tertiary">
                      {exception.school_year_label}
                    </td>{" "}
                    <td className="py-2 text-muted dark:text-slate-400">
                      {" "}
                      {formatWeekdays(exception.school_weekdays)}{" "}
                    </td>{" "}
                    <td className="py-2 text-interactive-hover">
                      {" "}
                      {formatWeekdays(exception.configured_weekdays)}{" "}
                    </td>{" "}
                  </tr>
                ))}{" "}
              </tbody>{" "}
            </table>{" "}
          </div>
        )}{" "}
      </Card>{" "}
    </div>
  );
}
function formatWeekdays(days: number[]) {
  if (!days || days.length === 0) return "-";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d] || "?")
    .join(",");
}
function SchoolYearCard({
  year,
  isPending,
  onApplyWeekdays,
  onUpdateYear,
  onAddOverride,
  onRemoveOverride,
  onDelete,
}: {
  year: SchoolYear;
  isPending: boolean;
  onApplyWeekdays: (yearId: string, weekdays: number[]) => void;
  onUpdateYear: (formData: FormData) => void;
  onAddOverride: (formData: FormData) => void;
  onRemoveOverride: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showAddOverride, setShowAddOverride] = useState(false);
  const [editingYear, setEditingYear] = useState(false);
  const [draftWeekdays, setDraftWeekdays] = useState<number[]>(year.weekdays);
  useEffect(() => {
    setDraftWeekdays(year.weekdays);
  }, [year.id, year.weekdays]);
  const weekdayChanges = hasWeekdayChanges(draftWeekdays, year.weekdays);
  function toggleDraftWeekday(day: number) {
    setDraftWeekdays((prev) =>
      prev.includes(day)
        ? prev.filter((d) => d !== day)
        : normalizeWeekdays([...prev, day]),
    );
  }
  return (
    <Card>
      {" "}
      {/* Header */}{" "}
      <div className="mb-4 flex items-center justify-between">
        {" "}
        <div className="w-full">
          {" "}
          <h3 className="text-lg font-semibold">{year.label}</h3>{" "}
          <p className="text-sm text-muted dark:text-slate-400">
            {" "}
            {new Date(year.start_date + "T00:00:00").toLocaleDateString()}{" "}
            &ndash;{""}{" "}
            {new Date(year.end_date + "T00:00:00").toLocaleDateString()}{" "}
            <span className="ml-3 text-gray-400 dark:text-slate-500">
              {" "}
              {year.lesson_count} lesson
              {year.lesson_count !== 1 ? "s" : ""}{" "}
            </span>{" "}
          </p>{" "}
          {editingYear && (
            <form
              action={(formData) => {
                onUpdateYear(formData);
                setEditingYear(false);
              }}
              className="mt-3 grid grid-cols-1 gap-2 rounded-lg border border-light bg-surface-muted p-3 sm:grid-cols-4"
            >
              {" "}
              <input type="hidden" name="id" value={year.id} />{" "}
              <input
                name="label"
                defaultValue={year.label}
                required
                className="rounded border border-border bg-surface px-2 py-1 text-sm text-primary"
              />{" "}
              <input
                name="start_date"
                type="date"
                defaultValue={year.start_date}
                required
                className="rounded border border-border bg-surface px-2 py-1 text-sm text-primary"
              />{" "}
              <input
                name="end_date"
                type="date"
                defaultValue={year.end_date}
                required
                className="rounded border border-border bg-surface px-2 py-1 text-sm text-primary"
              />{" "}
              <div className="flex items-center gap-2">
                {" "}
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-interactive px-3 py-1 text-xs font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
                >
                  {" "}
                  Save{" "}
                </button>{" "}
                <button
                  type="button"
                  onClick={() => setEditingYear(false)}
                  className="rounded border border-border px-3 py-1 text-xs text-tertiary hover:bg-surface-subtle dark:hover:bg-slate-700"
                >
                  {" "}
                  Cancel{" "}
                </button>{" "}
              </div>{" "}
            </form>
          )}{" "}
        </div>{" "}
        <div className="ml-3 flex shrink-0 gap-2">
          {" "}
          <button
            onClick={() => setEditingYear((v) => !v)}
            aria-label={
              editingYear
                ? `Close editing for ${year.label}`
                : `Edit dates and label for ${year.label}`
            }
            className="rounded-lg border border-border px-2.5 py-1 text-xs text-secondary hover:bg-surface-muted dark:hover:bg-slate-800"
          >
            {" "}
            {editingYear ? "Close" : "Edit Dates & Label"}{" "}
          </button>{" "}
          <button
            onClick={() => onDelete(year.id)}
            aria-label={`Delete school year ${year.label}`}
            className="rounded-lg border border-[var(--error-border)] px-2.5 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)]"
          >
            {" "}
            Delete{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
      {/* School days */}{" "}
      <div className="mb-5">
        {" "}
        <h4 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted dark:text-slate-400">
          {" "}
          School Days{" "}
        </h4>{" "}
        <div className="flex gap-2">
          {" "}
          {WEEKDAY_LABELS.map((label, i) => {
            const active = draftWeekdays.includes(i);
            return (
              <button
                key={i}
                onClick={() => toggleDraftWeekday(i)}
                disabled={isPending}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${active ? "bg-interactive-medium text-interactive-hover ring-1 ring-[var(--interactive-border)]" : "bg-surface-subtle text-gray-400 hover:bg-gray-200 dark:text-slate-400 dark:hover:bg-slate-700"} disabled:opacity-50`}
              >
                {" "}
                {label}{" "}
              </button>
            );
          })}{" "}
        </div>{" "}
        <div className="mt-2 flex items-center gap-2">
          {" "}
          <button
            onClick={() => onApplyWeekdays(year.id, draftWeekdays)}
            disabled={
              isPending || !weekdayChanges || draftWeekdays.length === 0
            }
            className="rounded bg-interactive px-3 py-1 text-xs font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
          >
            {" "}
            Apply School Days{" "}
          </button>{" "}
          <button
            onClick={() => setDraftWeekdays(year.weekdays)}
            disabled={isPending || !weekdayChanges}
            className="rounded border border-border px-3 py-1 text-xs text-tertiary hover:bg-surface-subtle disabled:opacity-50 dark:hover:bg-slate-700"
          >
            {" "}
            Reset{" "}
          </button>{" "}
          {weekdayChanges && (
            <span className="text-xs text-amber-600">
              Unsaved weekday changes
            </span>
          )}{" "}
        </div>{" "}
      </div>{" "}
      {/* Date overrides */}{" "}
      <div>
        {" "}
        <div className="mb-2 flex items-center justify-between">
          {" "}
          <h4 className="text-sm font-semibold uppercase tracking-wider text-muted dark:text-slate-400">
            {" "}
            Date Overrides{" "}
          </h4>{" "}
          <button
            onClick={() => setShowAddOverride(!showAddOverride)}
            className="text-xs font-medium text-interactive hover:text-interactive-hover"
          >
            {" "}
            {showAddOverride ? "Cancel" : "+ Add Override"}{" "}
          </button>{" "}
        </div>{" "}
        {showAddOverride && (
          <form
            action={(formData) => {
              onAddOverride(formData);
              setShowAddOverride(false);
            }}
            className="mb-3 flex flex-wrap items-end gap-3 rounded-lg border border-light bg-surface-muted p-3"
          >
            {" "}
            <input type="hidden" name="school_year_id" value={year.id} />{" "}
            <div>
              {" "}
              <label className="block text-xs font-medium text-tertiary">
                Date
              </label>{" "}
              <input
                name="date"
                type="date"
                required
                className="mt-0.5 rounded border border-border bg-surface px-2 py-1 text-sm text-primary"
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="block text-xs font-medium text-tertiary">
                Type
              </label>{" "}
              <select
                name="type"
                className="mt-0.5 rounded border border-border bg-surface px-2 py-1 text-sm text-primary"
              >
                {" "}
                <option value="exclude">Day Off (exclude)</option>{" "}
                <option value="include">Make-up Day (include)</option>{" "}
              </select>{" "}
            </div>{" "}
            <div className="flex-1">
              {" "}
              <label className="block text-xs font-medium text-tertiary">
                Reason
              </label>{" "}
              <input
                name="reason"
                placeholder="e.g. Thanksgiving"
                className="mt-0.5 w-full rounded border border-border bg-surface px-2 py-1 text-sm text-primary"
              />{" "}
            </div>{" "}
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-interactive px-3 py-1 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              Add{" "}
            </button>{" "}
          </form>
        )}{" "}
        {year.overrides.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">
            No overrides set.
          </p>
        ) : (
          <div className="space-y-1">
            {" "}
            {year.overrides.map((ov) => (
              <div
                key={ov.id}
                className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm hover:bg-surface-muted dark:hover:bg-slate-800"
              >
                {" "}
                <div className="flex items-center gap-3">
                  {" "}
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${ov.type === "exclude" ? "bg-red-100 text-red-700/30 dark:text-red-300" : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"}`}
                  >
                    {" "}
                    {ov.type === "exclude" ? "Off" : "On"}{" "}
                  </span>{" "}
                  <span className="font-medium">
                    {" "}
                    {new Date(ov.date + "T00:00:00").toLocaleDateString()}{" "}
                  </span>{" "}
                  {ov.reason && (
                    <span className="text-muted dark:text-slate-400">
                      {ov.reason}
                    </span>
                  )}{" "}
                </div>{" "}
                <button
                  onClick={() => onRemoveOverride(ov.id)}
                  disabled={isPending}
                  aria-label={`Remove override on ${new Date(ov.date + "T00:00:00").toLocaleDateString()}`}
                  className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 dark:text-slate-500 dark:hover:text-red-300"
                >
                  {" "}
                  Remove{" "}
                </button>{" "}
              </div>
            ))}{" "}
          </div>
        )}{" "}
      </div>{" "}
    </Card>
  );
}
