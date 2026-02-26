"use client";

type CompletionWeek = { week_start: string; count: number };
type SubjectStat = {
  subject_name: string;
  subject_color: string | null;
  lesson_count: number;
};

type Props = {
  completionTrend: CompletionWeek[];
  subjectBalance: SubjectStat[];
  avgDaysToComplete: number | null;
  activeChildren: Array<{ id: string; name: string }>;
};

const defaultColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
];

export default function AdminAnalytics({
  completionTrend,
  subjectBalance,
  avgDaysToComplete,
  activeChildren,
}: Props) {
  const maxCompletions = Math.max(
    ...completionTrend.map((w) => w.count),
    1
  );
  const maxLessons = Math.max(...subjectBalance.map((s) => s.lesson_count), 1);

  const busiestWeek = completionTrend.reduce(
    (best, w) => (w.count > (best?.count ?? 0) ? w : best),
    completionTrend[0] as CompletionWeek | undefined
  );

  const mostActiveSubject = subjectBalance[0];

  return (
    <div className="mt-8 space-y-6">
      <h2 className="text-lg font-semibold text-primary">Analytics</h2>

      {/* Quick stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border bg-surface p-4">
          <p className="text-xs font-medium uppercase text-muted">
            Avg Days to Complete
          </p>
          <p className="mt-1 text-2xl font-bold text-interactive">
            {avgDaysToComplete !== null ? avgDaysToComplete : "--"}
          </p>
          <p className="text-xs text-tertiary">
            from planned date to completion
          </p>
        </div>
        <div className="rounded-lg border bg-surface p-4">
          <p className="text-xs font-medium uppercase text-muted">
            Most Active Subject
          </p>
          <p className="mt-1 text-2xl font-bold text-interactive">
            {mostActiveSubject?.subject_name || "--"}
          </p>
          <p className="text-xs text-tertiary">
            {mostActiveSubject
              ? `${mostActiveSubject.lesson_count} lessons`
              : "no data"}
          </p>
        </div>
        <div className="rounded-lg border bg-surface p-4">
          <p className="text-xs font-medium uppercase text-muted">
            Busiest Week
          </p>
          <p className="mt-1 text-2xl font-bold text-interactive">
            {busiestWeek
              ? `${busiestWeek.count} completed`
              : "--"}
          </p>
          <p className="text-xs text-tertiary">
            {busiestWeek
              ? `Week of ${new Date(busiestWeek.week_start).toLocaleDateString()}`
              : "no data"}
          </p>
        </div>
        <div className="rounded-lg border bg-surface p-4">
          <p className="text-xs font-medium uppercase text-muted">
            Active Students (30d)
          </p>
          <p className="mt-1 text-2xl font-bold text-interactive">
            {activeChildren.length}
          </p>
          <p className="text-xs text-tertiary">
            {activeChildren.map((c) => c.name).join(", ") || "none"}
          </p>
        </div>
      </div>

      {/* Completion trend - vertical bar chart */}
      {completionTrend.length > 0 && (
        <div className="rounded-lg border bg-surface p-4">
          <h3 className="mb-4 text-sm font-semibold text-secondary">
            Completions Per Week (Last 12 Weeks)
          </h3>
          <div className="flex items-end gap-1" style={{ height: 160 }}>
            {completionTrend.map((w) => {
              const pct = (w.count / maxCompletions) * 100;
              const weekLabel = new Date(w.week_start).toLocaleDateString(
                undefined,
                { month: "short", day: "numeric" }
              );
              return (
                <div
                  key={w.week_start}
                  className="group flex flex-1 flex-col items-center"
                >
                  <span className="mb-1 text-xs font-medium text-secondary opacity-0 transition-opacity group-hover:opacity-100">
                    {w.count}
                  </span>
                  <div
                    className="w-full rounded-t bg-interactive transition-all hover:opacity-80"
                    style={{
                      height: `${Math.max(pct, 2)}%`,
                      minHeight: 4,
                    }}
                  />
                  <span className="mt-1 text-[10px] text-muted">
                    {weekLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subject balance - horizontal bars */}
      {subjectBalance.length > 0 && (
        <div className="rounded-lg border bg-surface p-4">
          <h3 className="mb-4 text-sm font-semibold text-secondary">
            Lesson Distribution by Subject
          </h3>
          <div className="space-y-3">
            {subjectBalance.map((s, i) => {
              const pct = (s.lesson_count / maxLessons) * 100;
              const color =
                s.subject_color || defaultColors[i % defaultColors.length];
              return (
                <div key={s.subject_name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium text-secondary">
                      {s.subject_name}
                    </span>
                    <span className="text-xs text-muted">
                      {s.lesson_count} lessons
                    </span>
                  </div>
                  <div className="h-4 w-full overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
