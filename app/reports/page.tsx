export const dynamic = "force-dynamic";

import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import { getAllChildren } from "@/lib/queries/students";
import { getProgressReport } from "@/lib/queries/reports";

type ReportData = Awaited<ReturnType<typeof getProgressReport>>;

function performanceFeedback(percent: number): string {
  if (percent >= 85) return "Excellent consistency - strong momentum this year.";
  if (percent >= 65) return "Solid progress - you are mostly on track.";
  if (percent >= 40) return "Making progress - a little focus this week will help.";
  return "Early-stage progress - consider a lighter catch-up plan for the next few days.";
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { student?: string };
}) {
  const children = await getAllChildren();

  const reports = await Promise.all(
    children.map(async (c: Record<string, string>) => ({
      childId: c.id,
      childName: c.name,
      report: await getProgressReport(c.id),
    }))
  );

  const totalLessons = reports.reduce(
    (acc, r) => acc + Number(r.report.overall.total_lessons || 0),
    0
  );
  const completedLessons = reports.reduce(
    (acc, r) => acc + Number(r.report.overall.completed || 0),
    0
  );
  const inProgressLessons = reports.reduce(
    (acc, r) => acc + Number(r.report.overall.in_progress || 0),
    0
  );
  const overallPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const selectedId = searchParams?.student || "";
  const selected = reports.find((r) => r.childId === selectedId) || null;

  return (
    <div>
      <PageHeader title="Progress Reports" />

      <Card title="Students">
        {reports.length === 0 ? (
          <p className="text-sm text-gray-400">No students yet.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {reports.map((r) => {
              const pct =
                Number(r.report.overall.total_lessons) > 0
                  ? Math.round(
                      (Number(r.report.overall.completed) /
                        Number(r.report.overall.total_lessons)) *
                        100
                    )
                  : 0;
              const active = selectedId === r.childId;

              return (
                <Link
                  key={r.childId}
                  href={`/reports?student=${r.childId}`}
                  className={`rounded-lg border px-3 py-2 transition-colors ${
                    active ? "border-primary-300 bg-primary-50" : "hover:bg-gray-50"
                  }`}
                >
                  <p className="font-medium text-gray-900">{r.childName}</p>
                  <p className="text-xs text-gray-500">{pct}% complete</p>
                </Link>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="Overall Household Progress" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-sm text-gray-500">Completion</p>
            <p className="text-2xl font-bold">{overallPct}%</p>
            <ProgressBar value={overallPct} showLabel={false} color="success" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Completed Lessons</p>
            <p className="text-2xl font-bold text-success-600">{completedLessons}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">In Progress</p>
            <p className="text-2xl font-bold text-warning-600">{inProgressLessons}</p>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600">{performanceFeedback(overallPct)}</p>
      </Card>

      <Card title="Student Detail" className="mt-6">
        {!selected ? (
          <p className="text-sm text-gray-500">Select a student above to view their personal progress report.</p>
        ) : (
          <StudentReport childName={selected.childName} report={selected.report} />
        )}
      </Card>
    </div>
  );
}

function StudentReport({ childName, report }: { childName: string; report: ReportData }) {
  const completionPct =
    Number(report.overall.total_lessons) > 0
      ? Math.round((Number(report.overall.completed) / Number(report.overall.total_lessons)) * 100)
      : 0;

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold">{childName}</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div>
          <p className="text-sm text-gray-500">Completion</p>
          <p className="text-xl font-bold">{completionPct}%</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-xl font-bold text-success-600">{String(report.overall.completed)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-xl font-bold text-warning-600">{String(report.overall.in_progress)}</p>
        </div>
      </div>

      <div className="space-y-3">
        {report.subjects.map((s: Record<string, string | number>) => {
          const pct =
            Number(s.total_lessons) > 0
              ? Math.round((Number(s.completed) / Number(s.total_lessons)) * 100)
              : 0;
          return (
            <div key={String(s.subject_id)}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-gray-800">{String(s.subject_name)}</span>
                <span className="text-gray-500">
                  {String(s.completed)}/{String(s.total_lessons)} lessons
                </span>
              </div>
              <ProgressBar value={pct} showLabel={false} color="success" />
            </div>
          );
        })}
      </div>
    </div>
  );
}
