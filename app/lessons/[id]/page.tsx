export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Badge from "@/components/ui/Badge";
import { getLessonDetails } from "@/lib/queries/lessons";
import { getAllChildren } from "@/lib/queries/students";
import { getAllResources } from "@/lib/queries/resources";
import EditLessonButton from "@/components/lessons/EditLessonButton";
import LessonResourcesManager from "@/components/lessons/LessonResourcesManager";
import CompletionForm from "./CompletionForm";
import KidCompletionModal from "@/components/lessons/KidCompletionModal";
import { getCurrentUser } from "@/lib/session";
export default async function LessonDetailPage({
  params,
}: {
  params: { id: string };
}) {
  if (!params?.id || typeof params.id !== "string") {
    notFound();
  }
  let lesson: Awaited<ReturnType<typeof getLessonDetails>>;
  let childrenData: Awaited<ReturnType<typeof getAllChildren>>;
  let libraryResources: Awaited<ReturnType<typeof getAllResources>>;
  const user = await getCurrentUser();
  try {
    [lesson, childrenData, libraryResources] = await Promise.all([
      getLessonDetails(
        params.id,
        user.role === "kid" ? user.childId || undefined : undefined,
      ),
      getAllChildren(user.role === "parent" ? user.id : undefined),
      getAllResources(),
    ]);
  } catch {
    notFound();
  }
  if (!lesson) notFound();
  const readOnlyKid = user.role === "kid";
  if (readOnlyKid && user.childId && lesson.child_id !== user.childId) {
    notFound();
  }
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
  const isCompleted = lesson.status === "completed";
  return (
    <div className="mx-auto max-w-4xl">
      {" "}
      {/* Header with title, status, and actions */}{" "}
      <PageHeader title={lesson.title}>
        {" "}
        <div className="flex gap-2">
          {" "}
          {!readOnlyKid && (
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
          )}{" "}
          <Link
            href="/lessons/table"
            className="rounded-lg border border-border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
          >
            {" "}
            Back to Lessons{" "}
          </Link>{" "}
        </div>{" "}
      </PageHeader>{" "}
      {/* Inherited context bar — always visible */}{" "}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl border border-light bg-surface p-4 shadow-sm">
        {" "}
        {/* Student */}{" "}
        <Link
          href={`/students/${lesson.child_id}`}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-secondary hover:bg-surface-muted"
        >
          {" "}
          <span className="text-lg">👤</span> {lesson.child_name}{" "}
        </Link>{" "}
        <span className="text-border">|</span>{" "}
        {/* Subject with color */}{" "}
        <Link
          href={`/subjects/${lesson.subject_id}`}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-secondary hover:bg-surface-muted"
        >
          {" "}
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: lesson.subject_color }}
          />{" "}
          {lesson.subject_name}{" "}
        </Link>{" "}
        <span className="text-border">|</span>{" "}
        {/* Curriculum */}{" "}
        <Link
          href={`/curricula/${lesson.curriculum_id}`}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-secondary hover:bg-surface-muted"
        >
          {" "}
          📋 {lesson.curriculum_name}{" "}
        </Link>{" "}
        <span className="text-border">|</span>{" "}
        {/* Status */} <Badge variant={statusVariant}>{lesson.status}</Badge>{" "}
        {/* Date */}{" "}
        {lesson.planned_date && (
          <>
            {" "}
            <span className="text-border">|</span>{" "}
            <span className="text-sm text-muted">
              {" "}
              📅 {new Date(lesson.planned_date).toLocaleDateString()}{" "}
            </span>{" "}
          </>
        )}{" "}
      </div>{" "}
      {/* Description */}{" "}
      {lesson.description && (
        <div className="mb-6 rounded-xl border border-light bg-surface p-5 shadow-sm">
          {" "}
          <h3 className="mb-2 text-sm font-semibold text-muted uppercase tracking-wider">
            {" "}
            Description{" "}
          </h3>{" "}
          <p className="text-secondary whitespace-pre-wrap">
            {lesson.description}
          </p>{" "}
        </div>
      )}{" "}
      {/* Completion section */}{" "}
      <div className="mb-6 rounded-xl border border-light bg-surface p-5 shadow-sm">
        {" "}
        <h3 className="mb-3 text-sm font-semibold text-muted uppercase tracking-wider">
          {" "}
          Completion{" "}
        </h3>{" "}
        {lesson.completion ? (
          <div className="flex items-center gap-6">
            {" "}
            <div className="flex items-center gap-2">
              {" "}
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success-100 text-success-600">
                {" "}
                ✓{" "}
              </span>{" "}
              <span className="text-sm font-medium text-[var(--success-text)]">
                Completed
              </span>{" "}
            </div>{" "}
            {lesson.completion.grade != null && (
              <div>
                {" "}
                <span className="text-sm text-muted">
                  Grade:{" "}
                </span>{" "}
                <span className="text-lg font-bold">
                  {" "}
                  {Number(lesson.completion.grade).toFixed(0)}{" "}
                </span>{" "}
              </div>
            )}{" "}
            {lesson.completion.pass_fail && (
              <div>
                {" "}
                <span className="text-sm text-muted">
                  Result:{" "}
                </span>{" "}
                <span className="text-lg font-bold">
                  {" "}
                  {lesson.completion.pass_fail === "pass"
                    ? "Pass"
                    : "Fail"}{" "}
                </span>{" "}
              </div>
            )}{" "}
            {lesson.completion.notes && (
              <div className="text-sm text-tertiary">
                {" "}
                <span className="text-muted">
                  Notes:{" "}
                </span>{" "}
                {lesson.completion.notes}{" "}
              </div>
            )}{" "}
            <span className="ml-auto text-xs text-muted">
              {" "}
              {new Date(
                lesson.completion.completed_at,
              ).toLocaleDateString()}{" "}
            </span>{" "}
          </div>
        ) : readOnlyKid ? (
          <KidCompletionModal lessonId={lesson.id} childId={lesson.child_id} />
        ) : (
          <CompletionForm
            lessonId={lesson.id}
            childId={lesson.child_id}
            gradeType={
              (lesson.grade_type as "numeric" | "pass_fail") || "numeric"
            }
          />
        )}{" "}
      </div>{" "}
      {/* Resources — full width */}{" "}
      <LessonResourcesManager
        lessonId={lesson.id}
        resources={lesson.resources}
        curriculumResources={lesson.curriculumResources}
        readOnly={readOnlyKid}
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
          }),
        )}
      />{" "}
    </div>
  );
}
