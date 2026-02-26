"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";

type DayData = { date: string; total: number; completed: number };

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay();
}

function getDensityClass(total: number, completed: number): string {
  if (total === 0) return "bg-surface-muted";
  const pct = completed / total;
  if (pct === 0) return "bg-red-200 dark:bg-red-900/40";
  if (pct < 0.5) return "bg-yellow-200 dark:bg-yellow-900/40";
  if (pct < 1) return "bg-green-200 dark:bg-green-900/40";
  return "bg-green-400 dark:bg-green-700/60";
}

function getDensityLabel(total: number, completed: number): string {
  if (total === 0) return "No lessons";
  if (completed === total) return `${completed}/${total} completed`;
  return `${completed}/${total} completed`;
}

export default function SemesterOverview({
  startMonth,
  months,
  childId,
}: {
  startMonth: string;
  months: number;
  childId?: string;
}) {
  const [data, setData] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchData = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({
      startMonth,
      months: String(months),
    });
    if (childId) params.set("childId", childId);

    fetch(`/api/calendar/semester?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load semester data");
        return r.json();
      })
      .then((json) => {
        setData(json.data || []);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load semester data. Please try again.");
        setLoading(false);
      });
  }, [startMonth, months, childId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Build lookup: date string -> { total, completed }
  const dataByDate: Record<string, DayData> = {};
  for (const d of data) {
    dataByDate[d.date] = d;
  }

  // Parse start month
  const [startYear, startMo] = startMonth.split("-").map(Number);

  // Build array of months to render
  const monthsToRender: { year: number; month: number }[] = [];
  for (let i = 0; i < months; i++) {
    let mo = startMo + i;
    let yr = startYear;
    while (mo > 12) {
      mo -= 12;
      yr += 1;
    }
    monthsToRender.push({ year: yr, month: mo });
  }

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  if (loading) {
    return (
      <Card>
        <div className="flex items-center justify-center py-16 text-muted">
          Loading semester overview...
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <p className="rounded-lg bg-[var(--error-bg)] p-3 text-sm text-red-600" role="alert">
        {error}
      </p>
    );
  }

  // Summary stats
  const totalLessons = data.reduce((s, d) => s + d.total, 0);
  const totalCompleted = data.reduce((s, d) => s + d.completed, 0);
  const completionPct = totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  const daysWithLessons = data.filter((d) => d.total > 0).length;
  const daysAllComplete = data.filter((d) => d.total > 0 && d.completed === d.total).length;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-light bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-primary">{totalLessons}</p>
          <p className="text-xs text-muted">Total Lessons</p>
        </div>
        <div className="rounded-xl border border-light bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-primary">{totalCompleted}</p>
          <p className="text-xs text-muted">Completed</p>
        </div>
        <div className="rounded-xl border border-light bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-primary">{completionPct}%</p>
          <p className="text-xs text-muted">Completion Rate</p>
        </div>
        <div className="rounded-xl border border-light bg-surface p-3 text-center">
          <p className="text-2xl font-bold text-primary">{daysAllComplete}/{daysWithLessons}</p>
          <p className="text-xs text-muted">Days Fully Done</p>
        </div>
      </div>

      {/* Heatmap grid */}
      <Card>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {monthsToRender.map(({ year, month }) => {
            const daysInMonth = getDaysInMonth(year, month);
            const firstDay = getFirstDayOfWeek(year, month);

            return (
              <div key={`${year}-${month}`}>
                <p className="mb-2 text-sm font-semibold text-primary">
                  {MONTH_NAMES[month - 1]} {year}
                </p>
                {/* Day-of-week headers */}
                <div className="grid grid-cols-7 gap-[2px] mb-[2px]">
                  {DAY_LABELS.map((label, i) => (
                    <div
                      key={i}
                      className="flex h-4 items-center justify-center text-[9px] text-muted"
                    >
                      {label}
                    </div>
                  ))}
                </div>
                {/* Day cells */}
                <div className="grid grid-cols-7 gap-[2px]">
                  {/* Empty cells for offset */}
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {/* Day squares */}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                    const dayData = dataByDate[dateStr];
                    const total = dayData?.total ?? 0;
                    const completed = dayData?.completed ?? 0;
                    const isToday = dateStr === todayStr;
                    const densityClass = getDensityClass(total, completed);

                    return (
                      <div
                        key={day}
                        title={`${dateStr}: ${getDensityLabel(total, completed)}`}
                        className={`aspect-square rounded-sm ${densityClass} ${
                          isToday ? "ring-2 ring-[var(--interactive-border)]" : ""
                        }`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted">
          <span>Less</span>
          <div className="flex gap-[2px]">
            <div className="h-3 w-3 rounded-sm bg-surface-muted" title="No lessons" />
            <div className="h-3 w-3 rounded-sm bg-red-200 dark:bg-red-900/40" title="0% complete" />
            <div className="h-3 w-3 rounded-sm bg-yellow-200 dark:bg-yellow-900/40" title="1-49% complete" />
            <div className="h-3 w-3 rounded-sm bg-green-200 dark:bg-green-900/40" title="50-99% complete" />
            <div className="h-3 w-3 rounded-sm bg-green-400 dark:bg-green-700/60" title="100% complete" />
          </div>
          <span>More</span>
        </div>
      </Card>
    </div>
  );
}
