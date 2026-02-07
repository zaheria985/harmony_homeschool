export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import ProgressBar from "@/components/ui/ProgressBar";
import { CurriculumViewToggle } from "@/components/curricula/CurriculumViewToggle";
import { getCurriculumDetail } from "@/lib/queries/curricula";

export default async function CurriculumDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const curriculum = await getCurriculumDetail(params.id);
  if (!curriculum) notFound();

  const totalLessons = curriculum.lessons.length;
  const completedLessons = curriculum.lessons.filter(
    (l: { status: string }) => l.status === "completed"
  ).length;
  const completionPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div>
      <PageHeader title={curriculum.name}>
        <div className="flex items-center gap-2">
          <CurriculumViewToggle curriculumId={params.id} />
          <Link
            href={`/subjects/${curriculum.subject_id}`}
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to {curriculum.subject_name}
          </Link>
        </div>
      </PageHeader>

      <div className="mb-6 flex items-center gap-3">
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: curriculum.subject_color }}
        />
        <span className="text-sm text-gray-500">
          <Link
            href={`/subjects/${curriculum.subject_id}`}
            className="text-primary-600 hover:underline"
          >
            {curriculum.subject_name}
          </Link>
          {" · "}
          <Link
            href={`/students/${curriculum.child_id}`}
            className="text-primary-600 hover:underline"
          >
            {curriculum.child_name}
          </Link>
        </span>
      </div>

      {curriculum.description && (
        <p className="mb-6 text-gray-600">{curriculum.description}</p>
      )}

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

      {/* Lessons */}
      <Card title="Lessons">
        {curriculum.lessons.length === 0 ? (
          <p className="py-4 text-center text-gray-400">No lessons yet</p>
        ) : (
          <div className="space-y-3">
            {curriculum.lessons.map(
              (l: Record<string, string | number | null>) => (
                <Link
                  key={String(l.id)}
                  href={`/lessons/${l.id}`}
                  className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-gray-50"
                >
                  <div>
                    <p className="font-medium">{String(l.title)}</p>
                    {l.description && (
                      <p className="mt-0.5 text-sm text-gray-500">
                        {String(l.description)}
                      </p>
                    )}
                    {l.planned_date && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {new Date(String(l.planned_date)).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    {l.grade != null && (
                      <span className="font-semibold text-primary-600">
                        {Number(l.grade).toFixed(0)}
                      </span>
                    )}
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
                  </div>
                </Link>
              )
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
