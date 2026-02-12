"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { prevWeek, nextWeek, getWeekStart } from "@/lib/utils/dates";
export default function WeekNav({ weekStart }: { weekStart: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qs = searchParams.get("child")
    ? `?child=${searchParams.get("child")}`
    : "";
  const todayWeek = getWeekStart(new Date());
  const isCurrentWeek = weekStart === todayWeek;
  return (
    <div className="flex items-center gap-2">
      {" "}
      <button
        onClick={() => router.push(`/week/${prevWeek(weekStart)}${qs}`)}
        className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-tertiary hover:bg-surface-muted dark:hover:bg-slate-800"
        title="Previous week"
      >
        {" "}
        &larr;{" "}
      </button>{" "}
      {!isCurrentWeek && (
        <button
          onClick={() => router.push(`/week/${todayWeek}${qs}`)}
          className="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-tertiary hover:bg-surface-muted dark:hover:bg-slate-800"
        >
          {" "}
          Today{" "}
        </button>
      )}{" "}
      <button
        onClick={() => router.push(`/week/${nextWeek(weekStart)}${qs}`)}
        className="rounded-lg border border-border px-2.5 py-1.5 text-sm text-tertiary hover:bg-surface-muted dark:hover:bg-slate-800"
        title="Next week"
      >
        {" "}
        &rarr;{" "}
      </button>{" "}
    </div>
  );
}
