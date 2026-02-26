"use client";

interface ProgressRow {
  year_name: string;
  child_name: string;
  curriculum_name: string;
  total_lessons: string;
  completed_lessons: string;
  avg_grade: string | null;
}

interface SubjectProgressReportProps {
  data: ProgressRow[];
}

function completionColor(pct: number): string {
  if (pct >= 75) return "text-success-600";
  if (pct >= 40) return "text-warning-600";
  return "text-muted";
}

export default function SubjectProgressReport({
  data,
}: SubjectProgressReportProps) {
  // Group by year_name
  const grouped: Record<string, ProgressRow[]> = {};
  for (const row of data) {
    if (!grouped[row.year_name]) grouped[row.year_name] = [];
    grouped[row.year_name].push(row);
  }

  const years = Object.keys(grouped);

  return (
    <div className="space-y-6">
      {years.map((year) => {
        const rows = grouped[year];
        const yearTotalLessons = rows.reduce(
          (sum, r) => sum + Number(r.total_lessons),
          0,
        );
        const yearCompletedLessons = rows.reduce(
          (sum, r) => sum + Number(r.completed_lessons),
          0,
        );
        const gradesWithValues = rows.filter((r) => r.avg_grade !== null);
        const yearAvgGrade =
          gradesWithValues.length > 0
            ? (
                gradesWithValues.reduce(
                  (sum, r) => sum + Number(r.avg_grade),
                  0,
                ) / gradesWithValues.length
              ).toFixed(1)
            : null;
        const yearPct =
          yearTotalLessons > 0
            ? Math.round((yearCompletedLessons / yearTotalLessons) * 100)
            : 0;

        return (
          <div key={year}>
            <h3 className="mb-3 text-lg font-semibold text-primary">{year}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-light text-left text-muted">
                    <th className="pb-2 pr-4 font-medium">Child</th>
                    <th className="pb-2 pr-4 font-medium">Curriculum</th>
                    <th className="pb-2 pr-4 text-right font-medium">
                      Lessons Done
                    </th>
                    <th className="pb-2 pr-4 text-right font-medium">
                      % Complete
                    </th>
                    <th className="pb-2 text-right font-medium">Avg Grade</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const total = Number(row.total_lessons);
                    const completed = Number(row.completed_lessons);
                    const pct =
                      total > 0 ? Math.round((completed / total) * 100) : 0;

                    return (
                      <tr
                        key={`${row.child_name}-${row.curriculum_name}-${i}`}
                        className="border-b border-light"
                      >
                        <td className="py-2 pr-4 text-primary">
                          {row.child_name}
                        </td>
                        <td className="py-2 pr-4 text-primary">
                          {row.curriculum_name}
                        </td>
                        <td className="py-2 pr-4 text-right text-primary">
                          {completed}/{total}
                        </td>
                        <td
                          className={`py-2 pr-4 text-right font-medium ${completionColor(pct)}`}
                        >
                          {pct}%
                        </td>
                        <td className="py-2 text-right text-primary">
                          {row.avg_grade !== null ? row.avg_grade : "--"}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Summary row */}
                  <tr className="bg-surface-muted font-medium">
                    <td className="py-2 pr-4 text-primary" colSpan={2}>
                      Year Total
                    </td>
                    <td className="py-2 pr-4 text-right text-primary">
                      {yearCompletedLessons}/{yearTotalLessons}
                    </td>
                    <td
                      className={`py-2 pr-4 text-right ${completionColor(yearPct)}`}
                    >
                      {yearPct}%
                    </td>
                    <td className="py-2 text-right text-primary">
                      {yearAvgGrade !== null ? yearAvgGrade : "--"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
