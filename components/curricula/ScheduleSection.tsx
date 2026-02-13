"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { autoScheduleLessons, clearSchedule, rescheduleAllLessons, setAssignmentDays } from "@/lib/actions/schedule";
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
type AssignmentSchedule = {
  assignmentId: string;
  childId: string;
  childName: string;
  configuredWeekdays: number[];
  schoolWeekdays: number[];
};
function sortUniqueWeekdays(weekdays: number[]) {
  return Array.from(new Set(weekdays)).sort((a, b) => a - b);
}
function formatWeekdays(weekdays: number[]) {
  return sortUniqueWeekdays(weekdays)
    .map((day) => WEEKDAY_LABELS[day])
    .join(",");
}
export default function ScheduleSection({
  curriculumId,
  assignments,
  unscheduledCount,
}: {
  curriculumId: string;
  assignments: AssignmentSchedule[];
  unscheduledCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [messageByAssignment, setMessageByAssignment] = useState<
    Record<string, string>
  >({});
  function getEffectiveDays(assignment: AssignmentSchedule) {
    const base =
      assignment.configuredWeekdays.length > 0
        ? assignment.configuredWeekdays
        : assignment.schoolWeekdays;
    return sortUniqueWeekdays(base);
  }
  function updateDays(assignment: AssignmentSchedule, nextDays: number[]) {
    startTransition(async () => {
      const result = await setAssignmentDays(assignment.assignmentId, nextDays);
      setMessageByAssignment((prev) => ({
        ...prev,
        [assignment.assignmentId]:
          "error" in result
            ? result.error || "Failed to save schedule."
            : "Schedule updated.",
      }));
      if (!("error" in result)) {
        router.refresh();
      }
    });
  }
  function toggleDay(assignment: AssignmentSchedule, day: number) {
    const effective = getEffectiveDays(assignment);
    const nextDays = effective.includes(day)
      ? effective.filter((d) => d !== day)
      : [...effective, day];
    updateDays(assignment, nextDays);
  }
  function handleAutoSchedule(assignment: AssignmentSchedule) {
    startTransition(async () => {
      const result = await autoScheduleLessons(
        curriculumId,
        assignment.childId,
      );
      if ("error" in result) {
        setMessageByAssignment((prev) => ({
          ...prev,
          [assignment.assignmentId]:
            result.error || "Failed to auto-schedule lessons.",
        }));
        return;
      }
      const tail =
        result.remaining > 0
          ? `${result.remaining} lesson(s) remained unscheduled.`
          : "";
      setMessageByAssignment((prev) => ({
        ...prev,
        [assignment.assignmentId]: `Scheduled ${result.scheduled} lesson(s).${tail}`,
      }));
      router.refresh();
    });
  }
  function handleClearSchedule(assignment: AssignmentSchedule) {
    if (!confirm("Clear all scheduled dates for non-completed lessons in this course?")) return;
    startTransition(async () => {
      const result = await clearSchedule(curriculumId);
      if ("error" in result) {
        setMessageByAssignment((prev) => ({
          ...prev,
          [assignment.assignmentId]: result.error || "Failed to clear schedule.",
        }));
        return;
      }
      setMessageByAssignment((prev) => ({
        ...prev,
        [assignment.assignmentId]: `Cleared ${result.cleared} lesson date(s).`,
      }));
      router.refresh();
    });
  }
  function handleRescheduleAll(assignment: AssignmentSchedule) {
    if (!confirm("This will clear all dates and re-schedule every non-completed lesson from the beginning. Continue?")) return;
    startTransition(async () => {
      const result = await rescheduleAllLessons(curriculumId, assignment.childId);
      if ("error" in result) {
        setMessageByAssignment((prev) => ({
          ...prev,
          [assignment.assignmentId]: result.error || "Failed to reschedule.",
        }));
        return;
      }
      const tail = result.remaining > 0
        ? ` ${result.remaining} lesson(s) remained unscheduled.`
        : "";
      setMessageByAssignment((prev) => ({
        ...prev,
        [assignment.assignmentId]: `Re-scheduled ${result.scheduled} lesson(s) from the beginning.${tail}`,
      }));
      router.refresh();
    });
  }
  if (assignments.length === 0) {
    return (
      <p className="text-sm text-muted">
        This course is not assigned to any student yet.
      </p>
    );
  }
  return (
    <div className="space-y-5">
      {" "}
      {assignments.map((assignment) => {
        const effectiveDays = getEffectiveDays(assignment);
        const usingFallback = assignment.configuredWeekdays.length === 0;
        const message = messageByAssignment[assignment.assignmentId] || "";
        const isError =
          message.toLowerCase().includes("failed") ||
          message.toLowerCase().includes("error");
        return (
          <div
            key={assignment.assignmentId}
            className="rounded-lg border border-light p-4"
          >
            {" "}
            <div className="mb-3 flex items-center justify-between gap-3">
              {" "}
              <div>
                {" "}
                <p className="text-sm font-semibold text-primary">
                  {assignment.childName}
                </p>{" "}
                <p className="text-xs text-muted">
                  {" "}
                  {usingFallback
                    ? "Every school day (default):"
                    : "Custom schedule:"}
                  {""}{" "}
                  {effectiveDays.length > 0
                    ? formatWeekdays(effectiveDays)
                    : "None"}{" "}
                </p>{" "}
              </div>{" "}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleAutoSchedule(assignment)}
                  disabled={isPending || unscheduledCount === 0}
                  className="rounded bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
                >
                  {isPending
                    ? "Working..."
                    : `Auto-schedule ${unscheduledCount} unscheduled`}
                </button>
                <button
                  onClick={() => handleRescheduleAll(assignment)}
                  disabled={isPending}
                  className="rounded border border-interactive-border px-3 py-1.5 text-xs font-medium text-interactive-hover hover:bg-interactive-light disabled:opacity-50"
                >
                  Reschedule All
                </button>
                <button
                  onClick={() => handleClearSchedule(assignment)}
                  disabled={isPending}
                  className="rounded border border-[var(--error-border)] px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-[var(--error-bg)] disabled:opacity-50"
                >
                  Clear Dates
                </button>
              </div>{" "}
            </div>{" "}
            <div className="flex flex-wrap gap-2">
              {" "}
              {WEEKDAY_LABELS.map((label, day) => {
                const active = effectiveDays.includes(day);
                const isSchoolDay = assignment.schoolWeekdays.includes(day);
                return (
                  <button
                    key={`${assignment.assignmentId}-${label}`}
                    onClick={() => toggleDay(assignment, day)}
                    disabled={isPending}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${active ? "border-interactive-border bg-interactive-medium text-interactive-hover ring-1 ring-[var(--interactive-border)]" : isSchoolDay ? "border-light bg-surface text-secondary hover:bg-surface-muted" : "border-dashed border-light bg-surface-subtle text-muted hover:bg-surface-muted"} disabled:opacity-50`}
                  >
                    {" "}
                    {label}{" "}
                  </button>
                );
              })}{" "}
            </div>{" "}
            <p className="mt-2 text-[11px] text-muted">
              Solid buttons are school-default days. Dashed buttons are non-school days.
            </p>
            {message && (
              <p
                className={`mt-3 text-xs ${isError ? "text-red-600" : "text-emerald-700"}`}
              >
                {message}
              </p>
            )}{" "}
          </div>
        );
      })}{" "}
    </div>
  );
}
