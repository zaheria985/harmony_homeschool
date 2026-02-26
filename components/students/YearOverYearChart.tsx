"use client";

interface YearData {
  year_id: string;
  year_name: string;
  total_curricula: number;
  total_lessons: number;
  completed_lessons: number;
  avg_grade: number | null;
}

function gradeColor(grade: number | null): string {
  if (grade === null || grade === 0) return "text-muted";
  if (grade >= 90) return "text-success-600";
  if (grade >= 80) return "text-interactive";
  if (grade >= 70) return "text-warning-600";
  return "text-red-600";
}

function gradeBg(grade: number | null): string {
  if (grade === null || grade === 0) return "bg-muted/20";
  if (grade >= 90) return "bg-success-600/15";
  if (grade >= 80) return "bg-interactive/15";
  if (grade >= 70) return "bg-warning-600/15";
  return "bg-red-600/15";
}

export default function YearOverYearChart({
  data,
  childId,
}: {
  data: YearData[];
  childId: string;
}) {
  const maxLessons = Math.max(...data.map((d) => d.total_lessons), 1);

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px_80px_100px_80px_40px] gap-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted">
        <span>School Year</span>
        <span className="text-right">Courses</span>
        <span className="text-right">Lessons</span>
        <span className="text-right">Done</span>
        <span className="text-right">Completion</span>
        <span className="text-right">Grade</span>
        <span></span>
      </div>

      {/* Year rows */}
      {data.map((year) => {
        const pct =
          year.total_lessons > 0
            ? Math.round((year.completed_lessons / year.total_lessons) * 100)
            : 0;

        return (
          <div
            key={year.year_id}
            className="rounded-lg border border-light bg-surface p-4 transition-colors hover:border-interactive/30"
          >
            {/* Desktop layout */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_80px_80px_80px_100px_80px_40px] gap-2 items-center">
              <span className="font-medium text-primary">{year.year_name}</span>
              <span className="text-right text-sm tabular-nums">{year.total_curricula}</span>
              <span className="text-right text-sm tabular-nums">{year.total_lessons}</span>
              <span className="text-right text-sm tabular-nums">{year.completed_lessons}</span>
              <div className="flex items-center gap-2 justify-end">
                <div className="h-2 w-16 overflow-hidden rounded-full bg-muted/20">
                  <div
                    className="h-full rounded-full bg-interactive transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-xs tabular-nums text-muted w-8 text-right">{pct}%</span>
              </div>
              <span
                className={`text-right text-sm font-semibold tabular-nums ${gradeColor(year.avg_grade)}`}
              >
                {year.avg_grade && Number(year.avg_grade) > 0
                  ? `${Number(year.avg_grade).toFixed(1)}%`
                  : "--"}
              </span>
              <div className="flex justify-end">
                <a
                  href={`/api/reports/year-summary?childId=${childId}&yearId=${year.year_id}`}
                  download
                  className="rounded p-1 text-muted hover:text-interactive hover:bg-interactive/10 transition-colors"
                  title="Download Year Report"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              </div>
            </div>

            {/* Mobile layout */}
            <div className="sm:hidden space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-primary">{year.year_name}</span>
                <a
                  href={`/api/reports/year-summary?childId=${childId}&yearId=${year.year_id}`}
                  download
                  className="rounded p-1 text-muted hover:text-interactive hover:bg-interactive/10 transition-colors"
                  title="Download Year Report"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-lg font-semibold tabular-nums">{year.total_curricula}</p>
                  <p className="text-xs text-muted">Courses</p>
                </div>
                <div>
                  <p className="text-lg font-semibold tabular-nums">
                    {year.completed_lessons}/{year.total_lessons}
                  </p>
                  <p className="text-xs text-muted">Lessons</p>
                </div>
                <div>
                  <p className={`text-lg font-semibold tabular-nums ${gradeColor(year.avg_grade)}`}>
                    {year.avg_grade && Number(year.avg_grade) > 0
                      ? `${Number(year.avg_grade).toFixed(1)}%`
                      : "--"}
                  </p>
                  <p className="text-xs text-muted">Avg Grade</p>
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between text-xs text-muted mb-1">
                  <span>Completion</span>
                  <span>{pct}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted/20">
                  <div
                    className="h-full rounded-full bg-interactive transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      })}

      {/* Visual comparison bars */}
      <div className="mt-6 rounded-lg border border-light bg-surface p-4">
        <h4 className="mb-3 text-sm font-semibold text-primary">Lesson Volume Comparison</h4>
        <div className="space-y-2">
          {data.map((year) => {
            const barWidth = Math.round((year.total_lessons / maxLessons) * 100);
            const completedWidth =
              year.total_lessons > 0
                ? Math.round((year.completed_lessons / maxLessons) * 100)
                : 0;
            return (
              <div key={year.year_id} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-xs text-muted truncate">
                  {year.year_name}
                </span>
                <div className="relative h-5 flex-1">
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-interactive/20"
                    style={{ width: `${barWidth}%` }}
                  />
                  <div
                    className="absolute inset-y-0 left-0 rounded bg-interactive"
                    style={{ width: `${completedWidth}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted">
                  {year.completed_lessons}/{year.total_lessons}
                </span>
              </div>
            );
          })}
        </div>
        <div className="mt-2 flex items-center gap-4 text-xs text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded bg-interactive" /> Completed
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-4 rounded bg-interactive/20" /> Total
          </span>
        </div>
      </div>
    </div>
  );
}
