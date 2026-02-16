"use client";
import { useMemo, useState, useTransition } from "react";
import { bulkCreateLessons } from "@/lib/actions/lessons";
type Course = {
  id: string;
  name: string;
  subject_name: string;
  child_name: string;
};
type Child = { id: string; name: string };
type SchoolYear = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
};
type LessonDraft = {
  title: string;
  planned_date: string;
  completed_date: string;
  pass_fail: "pass" | "fail" | "";
  description: string;
  status: "planned" | "in_progress" | "completed";
  error: string | null;
};
function parseRows(raw: string): LessonDraft[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const values = line.split(/[\t,]/).map((value) => value.trim());
      const title = values[0] || "";
      const dateInput = values[1] || "";
      const description = values[2] || "";
      const statusInput = (values[3] || "planned").toLowerCase();
      const status =
        statusInput === "in_progress" ||
        statusInput === "completed" ||
        statusInput === "planned"
          ? statusInput
          : "planned";
      const passFailInput = (values[4] || "").toLowerCase();
      const passFail =
        passFailInput === "pass" || passFailInput === "fail"
          ? passFailInput
          : "";
      const plannedDate = status === "completed" ? "" : dateInput;
      const completedDate = status === "completed" ? dateInput : "";
      let error: string | null = null;
      if (!title) {
        error = "Title is required";
      } else if (plannedDate && !/^\d{4}-\d{2}-\d{2}$/.test(plannedDate)) {
        error = "Planned date must be YYYY-MM-DD";
      } else if (completedDate && !/^\d{4}-\d{2}-\d{2}$/.test(completedDate)) {
        error = "Completed date must be YYYY-MM-DD";
      } else if (
        values[3] &&
        !["planned", "in_progress", "completed"].includes(statusInput)
      ) {
        error = "Status must be planned, in_progress, or completed";
      } else if (values[4] && !["pass", "fail"].includes(passFailInput)) {
        error = "Result must be pass or fail";
      }
      return {
        title,
        planned_date: plannedDate,
        completed_date: completedDate,
        pass_fail: passFail,
        description,
        status,
        error,
      };
    });
}
export default function AdminBulkPasteClient({
  curricula,
  children,
  schoolYears,
}: {
  curricula: Course[];
  children: Child[];
  schoolYears: SchoolYear[];
}) {
  const [courseId, setCourseId] = useState("");
  const [schoolYearId, setSchoolYearId] = useState("");
  const [selectedChildIds, setSelectedChildIds] = useState<string[]>([]);
  const [rawText, setRawText] = useState("");
  const [rows, setRows] = useState<LessonDraft[]>([]);
  const [resultMessage, setResultMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const validRows = useMemo(
    () => rows.filter((row) => !row.error && row.title.trim()),
    [rows],
  );
  const hasCompletedRows = validRows.some((row) => row.status === "completed");
  function updateRawAndRows(nextRaw: string) {
    setRawText(nextRaw);
    setRows(parseRows(nextRaw));
    setResultMessage("");
  }
  function toggleChild(id: string) {
    setSelectedChildIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id],
    );
  }
  function updateRow(
    index: number,
    field: keyof Omit<LessonDraft, "error">,
    value: string,
  ) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[index] };
      if (field === "status") {
        row.status =
          value === "in_progress" ||
          value === "completed" ||
          value === "planned"
            ? value
            : "planned";
      } else if (field === "title") {
        row.title = value;
      } else if (field === "planned_date") {
        row.planned_date = value;
      } else if (field === "completed_date") {
        row.completed_date = value;
      } else if (field === "pass_fail") {
        row.pass_fail = value === "pass" || value === "fail" ? value : "";
      } else {
        row.description = value;
      }
      row.error = null;
      if (!row.title.trim()) {
        row.error = "Title is required";
      } else if (
        row.planned_date &&
        !/^\d{4}-\d{2}-\d{2}$/.test(row.planned_date)
      ) {
        row.error = "Planned date must be YYYY-MM-DD";
      } else if (
        row.completed_date &&
        !/^\d{4}-\d{2}-\d{2}$/.test(row.completed_date)
      ) {
        row.error = "Completed date must be YYYY-MM-DD";
      }
      next[index] = row;
      return next;
    });
  }
  function handleCreateAll() {
    if (!courseId) {
      setResultMessage("Select a course first.");
      return;
    }
    if (selectedChildIds.length === 0) {
      setResultMessage("Select at least one child.");
      return;
    }
    if (validRows.length === 0) {
      setResultMessage("No valid rows to create.");
      return;
    }
    if (hasCompletedRows && !schoolYearId) {
      setResultMessage(
        "Select a school year when importing completed lessons.",
      );
      return;
    }
    startTransition(async () => {
      const result = await bulkCreateLessons(
        validRows.map((row) => ({
          title: row.title.trim(),
          curriculum_id: courseId,
          planned_date: row.planned_date || undefined,
          completed_date: row.completed_date || undefined,
          pass_fail: row.pass_fail || undefined,
          description: row.description || undefined,
          status: row.status,
        })),
        { childIds: selectedChildIds, schoolYearId: schoolYearId || undefined },
      );
      if ("error" in result) {
        setResultMessage(result.error || "Failed to create lessons.");
        return;
      }
      setResultMessage(`Created ${result.created} lesson(s).`);
      setRawText("");
      setRows([]);
    });
  }
  return (
    <div className="space-y-6">
      {" "}
      <div className="rounded-2xl border border-light bg-surface p-5 shadow-warm">
        {" "}
        <div className="grid gap-4 md:grid-cols-3">
          {" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Course
            </label>{" "}
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
            >
              {" "}
              <option value="">Select a course...</option>{" "}
              {curricula.map((course) => (
                <option key={course.id} value={course.id}>
                  {" "}
                  {course.child_name} - {course.subject_name}:{" "}
                  {course.name}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              School Year
            </label>{" "}
            <select
              value={schoolYearId}
              onChange={(e) => setSchoolYearId(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
            >
              {" "}
              <option value="">
                Optional (required for completed rows)
              </option>{" "}
              {schoolYears.map((year) => (
                <option key={year.id} value={year.id}>
                  {" "}
                  {year.label}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </div>{" "}
          <div className="text-sm text-muted">
            {" "}
            <p className="font-medium text-secondary">Paste format</p>{" "}
            <p>title | date | description | status | result</p>{" "}
            <p className="mt-1">
              Status controls whether date is planned or completed.
            </p>{" "}
          </div>{" "}
        </div>{" "}
        <div className="mt-4">
          {" "}
          <p className="mb-1 text-sm font-medium text-secondary">
            Import for
          </p>{" "}
          <div className="flex flex-wrap gap-2">
            {" "}
            {children.map((child) => (
              <label
                key={child.id}
                className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-secondary"
              >
                {" "}
                <input
                  type="checkbox"
                  checked={selectedChildIds.includes(child.id)}
                  onChange={() => toggleChild(child.id)}
                />{" "}
                {child.name}{" "}
              </label>
            ))}{" "}
          </div>{" "}
        </div>{" "}
        <div className="mt-4">
          {" "}
          <label className="mb-1 block text-sm font-medium text-secondary">
            Lesson rows
          </label>{" "}
          <textarea
            value={rawText}
            onChange={(e) => updateRawAndRows(e.target.value)}
            rows={10}
            placeholder="Fractions practice\t2026-02-15\tWorkbook pages 10-12\tplanned"
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 font-mono text-sm text-primary placeholder:text-[var(--input-placeholder)]"
          />{" "}
        </div>{" "}
      </div>{" "}
      <div className="rounded-2xl border border-light bg-surface p-5 shadow-warm">
        {" "}
        <div className="mb-3 flex items-center justify-between">
          {" "}
          <h2 className="text-lg font-semibold text-primary">Preview</h2>{" "}
          <span className="text-sm text-muted">
            {" "}
            {validRows.length} valid / {rows.length} total{" "}
          </span>{" "}
        </div>{" "}
        {rows.length === 0 ? (
          <p className="text-sm text-muted">
            Paste rows above to preview before creating.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {" "}
            <table className="min-w-full text-left text-sm">
              {" "}
              <thead className="border-b border-light bg-surface-muted text-xs uppercase text-muted">
                {" "}
                <tr>
                  {" "}
                  <th className="px-3 py-2">Title</th>{" "}
                  <th className="px-3 py-2">Status</th>{" "}
                  <th className="px-3 py-2">Planned Date</th>{" "}
                  <th className="px-3 py-2">Completed Date</th>{" "}
                  <th className="px-3 py-2">Description</th>{" "}
                  <th className="px-3 py-2">Result</th>{" "}
                  <th className="px-3 py-2">Validation</th>{" "}
                </tr>{" "}
              </thead>{" "}
              <tbody className="divide-y divide-border">
                {" "}
                {rows.map((row, index) => (
                  <tr
                    key={`${index}-${row.title}`}
                    className={row.error ? "bg-[var(--error-bg)]/60/20" : ""}
                  >
                    {" "}
                    <td className="px-3 py-2 align-top">
                      {" "}
                      <input
                        value={row.title}
                        onChange={(e) =>
                          updateRow(index, "title", e.target.value)
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-primary"
                      />{" "}
                    </td>{" "}
                    <td className="px-3 py-2 align-top">
                      {" "}
                      <select
                        value={row.status}
                        onChange={(e) =>
                          updateRow(index, "status", e.target.value)
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-primary"
                      >
                        {" "}
                        <option value="planned">planned</option>{" "}
                        <option value="in_progress">in_progress</option>{" "}
                        <option value="completed">completed</option>{" "}
                      </select>{" "}
                    </td>{" "}
                    <td className="px-3 py-2 align-top">
                      {" "}
                      <input
                        value={row.planned_date}
                        onChange={(e) =>
                          updateRow(index, "planned_date", e.target.value)
                        }
                        placeholder="YYYY-MM-DD"
                        disabled={row.status === "completed"}
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-primary disabled:bg-surface-subtle dark:disabled:bg-slate-800/60"
                      />{" "}
                    </td>{" "}
                    <td className="px-3 py-2 align-top">
                      {" "}
                      <input
                        value={row.completed_date}
                        onChange={(e) =>
                          updateRow(index, "completed_date", e.target.value)
                        }
                        placeholder="YYYY-MM-DD"
                        disabled={row.status !== "completed"}
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-primary disabled:bg-surface-subtle dark:disabled:bg-slate-800/60"
                      />{" "}
                    </td>{" "}
                    <td className="px-3 py-2 align-top">
                      {" "}
                      <input
                        value={row.description}
                        onChange={(e) =>
                          updateRow(index, "description", e.target.value)
                        }
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-primary"
                      />{" "}
                    </td>{" "}
                    <td className="px-3 py-2 align-top">
                      {" "}
                      <select
                        value={row.pass_fail}
                        onChange={(e) =>
                          updateRow(index, "pass_fail", e.target.value)
                        }
                        disabled={row.status !== "completed"}
                        className="w-full rounded border border-border bg-surface px-2 py-1 text-primary disabled:bg-surface-subtle dark:disabled:bg-slate-800/60"
                      >
                        {" "}
                        <option value="">(auto pass)</option>{" "}
                        <option value="pass">pass</option>{" "}
                        <option value="fail">fail</option>{" "}
                      </select>{" "}
                    </td>{" "}
                    <td className="px-3 py-2 align-top text-xs">
                      {" "}
                      {row.error ? (
                        <span className="font-medium text-red-700 dark:text-red-300">
                          {row.error}
                        </span>
                      ) : (
                        <span className="text-emerald-700 dark:text-emerald-300">
                          OK
                        </span>
                      )}{" "}
                    </td>{" "}
                  </tr>
                ))}{" "}
              </tbody>{" "}
            </table>{" "}
          </div>
        )}{" "}
        <div className="mt-4 flex items-center justify-between">
          {" "}
          <p
            className={`text-sm ${resultMessage.includes("Created") ? "text-emerald-700" : "text-red-700"}`}
          >
            {" "}
            {resultMessage}{" "}
          </p>{" "}
          <button
            onClick={handleCreateAll}
            disabled={
              isPending ||
              validRows.length === 0 ||
              !courseId ||
              selectedChildIds.length === 0
            }
            className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
          >
            {" "}
            {isPending
              ? "Creating..."
              : `Create All (${validRows.length})`}{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
