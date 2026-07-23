"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  setAttendanceOverride,
  clearAttendanceOverride,
} from "@/lib/actions/attendance";

type Day = {
  date: string;
  source: "derived" | "override";
  status: "present" | "absent" | "holiday";
  minutes: number;
  lessonsCompleted: number;
  note: string | null;
};

const STATUS_LABELS: Record<Day["status"], string> = {
  present: "Present",
  absent: "Absent",
  holiday: "Holiday",
};

export default function AttendanceDayRow({
  childId,
  day,
  defaultMinutes,
}: {
  childId: string;
  day: Day;
  defaultMinutes: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function apply(status: Day["status"], minutes: number | null) {
    setError(null);
    startTransition(async () => {
      const result = await setAttendanceOverride(
        childId,
        day.date,
        status,
        minutes,
        day.note,
      );
      if (result && "error" in result) setError(result.error ?? "Failed");
      else router.refresh();
    });
  }

  function reset() {
    setError(null);
    startTransition(async () => {
      const result = await clearAttendanceOverride(childId, day.date);
      if (result && "error" in result) setError(result.error ?? "Failed");
      else router.refresh();
    });
  }

  return (
    <tr className="border-b border-light last:border-0">
      <td className="py-2 pr-3 text-primary">{day.date}</td>
      <td className="py-2 pr-3">
        <select
          value={day.status}
          aria-label={`Attendance status for ${day.date}`}
          disabled={isPending}
          onChange={(event) =>
            apply(
              event.target.value as Day["status"],
              day.source === "override" ? day.minutes || null : null,
            )
          }
          className="rounded-lg border border-light bg-surface px-2 py-1 text-sm text-primary disabled:opacity-50"
        >
          {(Object.keys(STATUS_LABELS) as Day["status"][]).map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>
        {day.source === "override" && (
          <span className="ml-2 text-[10px] uppercase tracking-wide text-muted">
            edited
          </span>
        )}
        {error && <span className="ml-2 text-xs text-red-600">{error}</span>}
      </td>
      <td className="py-2 pr-3 text-muted">{day.lessonsCompleted}</td>
      <td className="py-2 pr-3">
        <input
          type="number"
          min={0}
          max={1440}
          defaultValue={day.minutes}
          aria-label={`Instructional minutes for ${day.date}`}
          disabled={isPending || day.status !== "present"}
          onBlur={(event) => {
            const next = Number(event.target.value);
            if (!Number.isFinite(next) || next === day.minutes) return;
            apply(day.status, next);
          }}
          className="w-20 rounded-lg border border-light bg-surface px-2 py-1 text-sm text-primary disabled:opacity-50"
        />
      </td>
      <td className="py-2">
        {day.source === "override" ? (
          <button
            type="button"
            onClick={reset}
            disabled={isPending}
            className="text-xs text-interactive hover:underline disabled:opacity-50"
            title={`Return ${day.date} to its automatic value (${defaultMinutes} min)`}
          >
            Reset
          </button>
        ) : (
          <span className="text-xs text-muted">auto</span>
        )}
      </td>
    </tr>
  );
}
