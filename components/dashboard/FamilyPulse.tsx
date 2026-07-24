import Link from "next/link";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";

type ProgressRow = {
  child_id: string;
  child_name: string;
  total_lessons: number;
  completed_lessons: number;
};
type CountRow = { child_id: string; completed_count: number };
type ReadingRow = {
  child_id: string;
  minutes: number;
  pages: number;
  books: number;
};
type StreakRow = {
  child_id: string;
  child_name: string;
  current: number;
  best: number;
};

/**
 * Per-child snapshot: year progress, what they finished this week, reading,
 * and their school-day streak. Everything here is already on other pages —
 * the point is seeing it per child without navigating.
 */
export default function FamilyPulse({
  yearLabel,
  progress,
  recentCompletions,
  reading,
  streaks,
  sinceDays,
}: {
  yearLabel: string | null;
  progress: ProgressRow[];
  recentCompletions: CountRow[];
  reading: ReadingRow[];
  streaks: StreakRow[];
  sinceDays: number;
}) {
  if (progress.length === 0 && streaks.length === 0) return null;

  const completedBy = new Map(
    recentCompletions.map((row) => [row.child_id, row.completed_count]),
  );
  const readingBy = new Map(reading.map((row) => [row.child_id, row]));
  const streakBy = new Map(streaks.map((row) => [row.child_id, row]));

  // Streaks cover every child; progress only those with assignments this year.
  const children = new Map<string, string>();
  for (const row of streaks) children.set(row.child_id, row.child_name);
  for (const row of progress) children.set(row.child_id, row.child_name);
  const rows = Array.from(children, ([child_id, child_name]) => ({
    child_id,
    child_name,
  })).sort((a, b) => a.child_name.localeCompare(b.child_name));

  return (
    <Card title="">
      <div className="-mt-2 mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-primary">This Week</h3>
        {yearLabel && (
          <span className="text-xs text-muted">{yearLabel} progress</span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {rows.map((row) => {
          const childProgress = progress.find((p) => p.child_id === row.child_id);
          const pct =
            childProgress && childProgress.total_lessons > 0
              ? Math.round(
                  (childProgress.completed_lessons / childProgress.total_lessons) * 100,
                )
              : 0;
          const finished = completedBy.get(row.child_id) ?? 0;
          const read = readingBy.get(row.child_id);
          const streak = streakBy.get(row.child_id);

          return (
            <div
              key={row.child_id}
              className="rounded-xl border border-light bg-surface-muted p-4"
            >
              <div className="mb-2 flex items-center justify-between">
                <Link
                  href={`/students/${row.child_id}`}
                  className="text-sm font-semibold text-interactive hover:underline"
                >
                  {row.child_name}
                </Link>
                {streak && streak.current > 0 && (
                  <span
                    className="text-xs font-medium text-secondary"
                    title={`Best streak: ${streak.best} school days`}
                  >
                    🔥 {streak.current} day{streak.current === 1 ? "" : "s"}
                  </span>
                )}
              </div>

              {childProgress && childProgress.total_lessons > 0 && (
                <div className="mb-3">
                  <ProgressBar value={pct} color="success" />
                  <p className="mt-1 text-xs text-muted">
                    {childProgress.completed_lessons} of {childProgress.total_lessons} lessons
                  </p>
                </div>
              )}

              <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
                <div className="flex gap-1">
                  <dt>Finished (last {sinceDays}d):</dt>
                  <dd className="font-medium text-secondary">{finished}</dd>
                </div>
                <div className="flex gap-1">
                  <dt>Reading:</dt>
                  <dd className="font-medium text-secondary">
                    {read && read.minutes > 0
                      ? `${read.minutes} min`
                      : read && read.pages > 0
                        ? `${read.pages} pages`
                        : "—"}
                  </dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
