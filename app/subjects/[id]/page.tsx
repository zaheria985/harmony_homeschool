export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import { getSubjectDetail } from "@/lib/queries/subjects";
import { getAllResources } from "@/lib/queries/resources";
import EditableLessonsTable from "@/components/lessons/EditableLessonsTable";
import pool from "@/lib/db";

async function getCurriculaForSubject(subjectId: string) {
  const res = await pool.query(
    `SELECT
       cu.id, cu.name,
       s.name AS subject_name,
       c.name AS child_name
     FROM curricula cu
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     WHERE cu.subject_id = $1
     ORDER BY c.name, cu.name`,
    [subjectId],
  );
  return res.rows;
}

export default async function SubjectDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [subject, resources, curricula] = await Promise.all([
    getSubjectDetail(params.id),
    getAllResources(),
    getCurriculaForSubject(params.id),
  ]);
  if (!subject) notFound();

  const totalLessons = subject.lessons.length;
  const completedLessons = subject.lessons.filter(
    (l: { status: string }) => l.status === "completed",
  ).length;
  const completionPct =
    totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div>
      {/* Subject banner image */}
      {subject.thumbnail_url && (
        <div className="mb-6 h-48 overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={subject.thumbnail_url}
            alt={subject.name}
            className="h-full w-full object-cover"
          />
        </div>
      )}

      <PageHeader title={subject.name}>
        <Link
          href="/subjects"
          className="rounded-lg border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
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
          <p className="text-sm text-muted">Total Lessons</p>
          <p className="font-display text-2xl">{totalLessons}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Completed</p>
          <p className="font-display text-2xl text-success-600">
            {completedLessons}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted">Progress</p>
          <p className="font-display text-2xl">{completionPct}%</p>
          <ProgressBar
            value={completionPct}
            showLabel={false}
            color="success"
          />
        </Card>
      </div>

      {/* Courses */}
      <Card title="Courses" className="mb-8">
        {subject.curricula.length === 0 ? (
          <p className="py-4 text-center text-muted">No courses yet</p>
        ) : (
          <div className="space-y-3">
            {subject.curricula.map((cu: Record<string, string | number>) => (
              <Link
                key={String(cu.id)}
                href={`/curricula/${cu.id}`}
                className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-surface-muted"
              >
                <div className="flex items-center gap-3">
                  {cu.cover_image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={String(cu.cover_image)}
                      alt={String(cu.name)}
                      className="h-12 w-12 rounded object-cover"
                    />
                  )}
                  <div>
                    <p className="font-medium">{String(cu.name)}</p>
                    {cu.description && (
                      <p className="mt-0.5 text-sm text-muted">
                        {String(cu.description)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="text-right text-sm text-muted">
                  {cu.completed_lessons}/{cu.total_lessons} lessons
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* All Lessons — editable table with sorting, inline editing, bulk ops */}
      <Card title="Lessons" className="mb-8">
        {subject.lessons.length === 0 ? (
          <p className="py-4 text-center text-muted">No lessons yet</p>
        ) : (
          <EditableLessonsTable
            lessons={subject.lessons}
            resources={resources.map(
              (r: { id: string; title: string; type: string }) => ({
                id: r.id,
                title: r.title,
                type: r.type,
              }),
            )}
            curricula={curricula}
          />
        )}
      </Card>
    </div>
  );
}
