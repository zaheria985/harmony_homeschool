export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import { getAllChildren } from "@/lib/queries/students";
import { getProgressReport } from "@/lib/queries/reports";

export default async function ReportsPage() {
  const children = await getAllChildren();

  const reports = await Promise.all(
    children.map(async (c: Record<string, string>) => ({
      childId: c.id,
      childName: c.name,
      report: await getProgressReport(c.id),
    }))
  );

  return (
    <div>
      <PageHeader title="Progress Reports" />

      <div className="space-y-8">
        {reports.map(({ childId, childName, report }) => {
          const completionPct =
            report.overall.total_lessons > 0
              ? Math.round(
                  (report.overall.completed / report.overall.total_lessons) * 100
                )
              : 0;

          return (
            <div key={childId}>
              <h2 className="mb-4 text-xl font-bold">{childName}</h2>

              {/* Overview */}
              <div className="mb-6 grid gap-4 sm:grid-cols-4">
                <Card>
                  <p className="text-sm text-gray-500">Completion</p>
                  <p className="text-2xl font-bold">{completionPct}%</p>
                  <ProgressBar value={completionPct} showLabel={false} color="success" />
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">Completed</p>
                  <p className="text-2xl font-bold text-success-600">
                    {report.overall.completed}
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">In Progress</p>
                  <p className="text-2xl font-bold text-warning-600">
                    {report.overall.in_progress}
                  </p>
                </Card>
                <Card>
                  <p className="text-sm text-gray-500">Avg Grade</p>
                  <p className="text-2xl font-bold">
                    {Number(report.overall.avg_grade).toFixed(1)}
                  </p>
                </Card>
              </div>

              {/* Subject Breakdown - CSS bar chart */}
              <Card title="Subject Breakdown">
                <div className="space-y-4">
                  {report.subjects.map(
                    (s: Record<string, string | number>) => {
                      const pct =
                        Number(s.total_lessons) > 0
                          ? Math.round(
                              (Number(s.completed) / Number(s.total_lessons)) * 100
                            )
                          : 0;
                      return (
                        <div key={`${childId}-${s.subject_name}`}>
                          <div className="mb-1 flex items-center justify-between text-sm">
                            <Link href={`/subjects/${s.subject_id}`} className="flex items-center gap-2 hover:opacity-80">
                              <span
                                className="h-3 w-3 rounded-full"
                                style={{
                                  backgroundColor: String(s.subject_color),
                                }}
                              />
                              <span className="font-medium text-primary-600 hover:underline">
                                {String(s.subject_name)}
                              </span>
                            </Link>
                            <div className="flex gap-4 text-gray-500">
                              <span>
                                {s.completed}/{s.total_lessons} lessons
                              </span>
                              <span>
                                Avg:{" "}
                                {Number(s.avg_grade) > 0
                                  ? Number(s.avg_grade).toFixed(1)
                                  : "--"}
                              </span>
                            </div>
                          </div>
                          {/* CSS bar */}
                          <div className="h-6 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className="flex h-full items-center rounded-full px-2 text-xs font-medium text-white transition-all"
                              style={{
                                width: `${Math.max(pct, 2)}%`,
                                backgroundColor: String(s.subject_color),
                              }}
                            >
                              {pct > 10 ? `${pct}%` : ""}
                            </div>
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>
              </Card>

              {/* Grade Distribution - simple CSS chart */}
              <Card title="Grade Averages by Subject" className="mt-6">
                <div className="flex items-end gap-4">
                  {report.subjects.map(
                    (s: Record<string, string | number>) => {
                      const grade = Number(s.avg_grade);
                      return (
                        <div
                          key={`${childId}-grade-${s.subject_name}`}
                          className="flex flex-1 flex-col items-center"
                        >
                          <span className="mb-1 text-xs font-semibold">
                            {grade > 0 ? grade.toFixed(0) : "--"}
                          </span>
                          <div
                            className="w-full rounded-t-lg transition-all"
                            style={{
                              height: `${grade > 0 ? grade * 1.5 : 10}px`,
                              backgroundColor: String(s.subject_color),
                              opacity: grade > 0 ? 1 : 0.2,
                            }}
                          />
                          <span className="mt-2 text-center text-xs text-gray-500">
                            {String(s.subject_name).split(" ")[0]}
                          </span>
                        </div>
                      );
                    }
                  )}
                </div>
              </Card>
            </div>
          );
        })}
      </div>
    </div>
  );
}
