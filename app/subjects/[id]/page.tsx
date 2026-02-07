export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { getSubjectDetail } from "@/lib/queries/subjects";

export default async function SubjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const subject = await getSubjectDetail(params.id);
  if (!subject) notFound();

  const totalLessons = subject.lessons.length;
  const completedLessons = subject.lessons.filter(
    (l: { status: string }) => l.status === "completed"
  ).length;
  const completionPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div>
      <PageHeader title={subject.name}>
        <Link
          href="/subjects"
          className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
        >
          Back to Subjects
        </Link>
      </PageHeader>

      <div className="mb-6 flex items-center gap-3">
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: subject.color }}
        />
      </div>

      {/* Overview */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-gray-500">Total Lessons</p>
          <p className="text-2xl font-bold">{totalLessons}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Completed</p>
          <p className="text-2xl font-bold text-success-600">{completedLessons}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500">Progress</p>
          <p className="text-2xl font-bold">{completionPct}%</p>
          <ProgressBar value={completionPct} showLabel={false} color="success" />
        </Card>
      </div>

      {/* Curricula */}
      <Card title="Curricula" className="mb-8">
        {subject.curricula.length === 0 ? (
          <p className="py-4 text-center text-gray-400">No curricula yet</p>
        ) : (
          <div className="space-y-3">
            {subject.curricula.map(
              (cu: Record<string, string | number>) => (
                <Link
                  key={String(cu.id)}
                  href={`/curricula/${cu.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">{String(cu.name)}</p>
                    {cu.description && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {String(cu.description)}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    {cu.completed_lessons}/{cu.total_lessons} lessons
                  </div>
                </Link>
              )
            )}
          </div>
        )}
      </Card>

      {/* All Lessons */}
      <Card title="Lessons">
        {subject.lessons.length === 0 ? (
          <p className="py-4 text-center text-gray-400">No lessons yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="pb-3 font-medium">Title</th>
                  <th className="pb-3 font-medium">Curriculum</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Grade</th>
                  <th className="pb-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {subject.lessons.map(
                  (l: Record<string, string | number | null>) => (
                    <tr key={String(l.id)} className="hover:bg-gray-50">
                      <td className="py-3">
                        <Link
                          href={`/lessons/${l.id}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          {String(l.title)}
                        </Link>
                      </td>
                      <td className="py-3">
                        <Link
                          href={`/curricula/${l.curriculum_id}`}
                          className="text-primary-600 hover:underline"
                        >
                          {String(l.curriculum_name)}
                        </Link>
                      </td>
                      <td className="py-3">
                        <Badge
                          variant={
                            l.status === "completed"
                              ? "success"
                              : l.status === "in_progress"
                                ? "warning"
                                : "default"
                          }
                        >
                          {String(l.status)}
                        </Badge>
                      </td>
                      <td className="py-3">
                        {l.grade != null ? (
                          <span className="font-semibold">
                            {Number(l.grade).toFixed(0)}
                          </span>
                        ) : (
                          <span className="text-gray-400">--</span>
                        )}
                      </td>
                      <td className="py-3 text-gray-500">
                        {l.planned_date
                          ? new Date(String(l.planned_date)).toLocaleDateString()
                          : "--"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
