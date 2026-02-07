export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { getLessonDetails } from "@/lib/queries/lessons";
import { getAllChildren } from "@/lib/queries/students";
import { getAllResources } from "@/lib/queries/resources";
import EditLessonButton from "@/components/lessons/EditLessonButton";
import LessonResourcesManager from "@/components/lessons/LessonResourcesManager";
import CompletionForm from "./CompletionForm";

export default async function LessonDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const [lesson, childrenData, libraryResources] = await Promise.all([
    getLessonDetails(params.id),
    getAllChildren(),
    getAllResources(),
  ]);
  if (!lesson) notFound();
  const children = childrenData.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));

  const statusVariant =
    lesson.status === "completed"
      ? "success"
      : lesson.status === "in_progress"
        ? "warning"
        : "default";

  return (
    <div>
      <PageHeader title={lesson.title}>
        <div className="flex gap-2">
          <EditLessonButton
            lesson={{
              id: lesson.id,
              title: lesson.title,
              description: lesson.description,
              planned_date: lesson.planned_date,
              curriculum_id: lesson.curriculum_id,
              child_id: lesson.child_id,
            }}
            children={children}
          />
          <Link
            href="/lessons"
            className="rounded-lg border px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50"
          >
            Back to Lessons
          </Link>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Details + Completion */}
        <div className="space-y-6">
          <Card title="Details">
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-500">Status</dt>
                <dd>
                  <Badge variant={statusVariant}>{lesson.status}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Student</dt>
                <dd className="font-medium">
                  <Link
                    href={`/students/${lesson.child_id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {lesson.child_name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Subject</dt>
                <dd>
                  <Link
                    href={`/subjects/${lesson.subject_id}`}
                    className="flex items-center gap-2 text-primary-600 hover:underline"
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: lesson.subject_color }}
                    />
                    {lesson.subject_name}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-500">Curriculum</dt>
                <dd>
                  <Link
                    href={`/curricula/${lesson.curriculum_id}`}
                    className="text-primary-600 hover:underline"
                  >
                    {lesson.curriculum_name}
                  </Link>
                </dd>
              </div>
              {lesson.planned_date && (
                <div>
                  <dt className="text-sm text-gray-500">Planned Date</dt>
                  <dd>{new Date(lesson.planned_date).toLocaleDateString()}</dd>
                </div>
              )}
              {lesson.description && (
                <div>
                  <dt className="text-sm text-gray-500">Description</dt>
                  <dd className="text-gray-700">{lesson.description}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card title="Completion">
            {lesson.completion ? (
              <div className="space-y-2">
                <p>
                  <span className="text-sm text-gray-500">Grade: </span>
                  <span className="text-xl font-bold">
                    {lesson.completion.grade != null
                      ? Number(lesson.completion.grade).toFixed(0)
                      : "--"}
                  </span>
                </p>
                {lesson.completion.notes && (
                  <p>
                    <span className="text-sm text-gray-500">Notes: </span>
                    {lesson.completion.notes}
                  </p>
                )}
                <p className="text-xs text-gray-400">
                  Completed{" "}
                  {new Date(lesson.completion.completed_at).toLocaleDateString()}
                </p>
              </div>
            ) : (
              <CompletionForm
                lessonId={lesson.id}
                childId={lesson.child_id}
              />
            )}
          </Card>
        </div>

        {/* Right column: Resources */}
        <LessonResourcesManager
          lessonId={lesson.id}
          resources={lesson.resources}
          curriculumResources={lesson.curriculumResources}
          libraryResources={libraryResources.map(
            (r: {
              id: string;
              title: string;
              type: string;
              url: string | null;
              description: string | null;
            }) => ({
              id: r.id,
              title: r.title,
              type: r.type,
              url: r.url,
              description: r.description,
            })
          )}
        />
      </div>
    </div>
  );
}
