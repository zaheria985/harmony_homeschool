export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import { getChildById, getChildProgress, getChildSubjects } from "@/lib/queries/students";
import { getUpcomingLessons } from "@/lib/queries/lessons";

export default async function StudentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const child = await getChildById(params.id);
  if (!child) notFound();

  const [progress, subjects, upcoming] = await Promise.all([
    getChildProgress(params.id),
    getChildSubjects(params.id),
    getUpcomingLessons(params.id, 5),
  ]);

  const completionPct =
    progress.total_lessons > 0
      ? Math.round((progress.completed / progress.total_lessons) * 100)
      : 0;

  return (
    <div>
      <PageHeader title={child.name} />

      {/* Overview stats */}
      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        <Card>
          <p className="text-sm text-gray-500">Total Lessons</p>
          <p className="text-2xl font-bold">{progress.total_lessons}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-success-600">{progress.completed}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">In Progress</p>
          <p className="text-2xl font-bold text-warning-600">{progress.in_progress}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Average Grade</p>
          <p className="text-2xl font-bold">{Number(progress.avg_grade).toFixed(1)}</p>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Subjects */}
        <Card title="Subjects">
          <div className="space-y-4">
            {subjects.map((s: Record<string, string | number>) => (
              <div key={String(s.id)} className="rounded-lg border p-4">
                <div className="mb-2 flex items-center justify-between">
                  <Link href={`/subjects/${s.id}`} className="flex items-center gap-2 hover:opacity-80">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: String(s.color) }}
                    />
                    <span className="font-medium text-primary-600 hover:underline">{String(s.name)}</span>
                  </Link>
                  <span className="text-sm text-gray-500">
                    Avg: {Number(s.avg_grade).toFixed(1)}
                  </span>
                </div>
                <ProgressBar
                  value={Number(s.completed_lessons)}
                  max={Number(s.total_lessons)}
                  color="primary"
                />
                <p className="mt-1 text-xs text-gray-400">
                  {s.completed_lessons} / {s.total_lessons} lessons
                </p>
              </div>
            ))}
          </div>
        </Card>

        {/* Upcoming */}
        <Card title="Upcoming Lessons">
          {upcoming.length === 0 ? (
            <p className="py-4 text-center text-gray-400">No upcoming lessons</p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((l: Record<string, string | number | null>) => (
                <div
                  key={String(l.id)}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div>
                    <Link href={`/lessons/${l.id}`} className="font-medium text-primary-600 hover:underline">
                      {String(l.title)}
                    </Link>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={l.status === "in_progress" ? "warning" : "default"}>
                        {String(l.status)}
                      </Badge>
                      <Link href={`/subjects/${l.subject_id}`}>
                        <Badge variant="primary">{String(l.subject_name)}</Badge>
                      </Link>
                    </div>
                  </div>
                  {l.planned_date && (
                    <span className="text-sm text-gray-500">
                      {new Date(String(l.planned_date)).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Overall progress bar */}
      <div className="mt-6">
        <Card title="Overall Progress">
          <div className="space-y-2">
            <ProgressBar value={completionPct} color="success" />
            <p className="text-sm text-gray-500">
              {completionPct}% complete ({progress.completed} of {progress.total_lessons} lessons)
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
