export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Link from "next/link";
import CurriculumBoard from "@/components/curricula/CurriculumBoard";
import { CurriculumViewToggle } from "@/components/curricula/CurriculumViewToggle";
import { getCurriculumBoardData, getArchivedLessonCount } from "@/lib/queries/curricula";
import { getLinkedBooklists, getAllBooklistSummaries } from "@/lib/queries/booklists";
import { getCurrentUser } from "@/lib/session";
import LinkedBooklists from "@/components/curricula/LinkedBooklists";
import LessonTemplateManager from "@/components/curricula/LessonTemplateManager";
import AICurriculumPlanModal from "@/components/curricula/AICurriculumPlanModal";
export default async function CurriculumBoardPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { showArchived?: string };
}) {
  const showArchived = searchParams.showArchived === "true";
  const [data, user, linkedBooklists, allBooklists, archivedCount] = await Promise.all([
    getCurriculumBoardData(params.id, showArchived),
    getCurrentUser(),
    getLinkedBooklists(params.id),
    getAllBooklistSummaries(),
    getArchivedLessonCount(params.id),
  ]);
  if (!data) notFound();
  return (
    <div>
      {" "}
      {data.cover_image && (
        <div className="mb-6 h-48 overflow-hidden rounded-xl">
          {" "}
          {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
          <img
            src={data.cover_image}
            alt={data.name}
            className="h-full w-full object-cover"
          />{" "}
        </div>
      )}{" "}
      <PageHeader title={data.name}>
        {" "}
        <div className="flex items-center gap-2">
          {" "}
          <CurriculumViewToggle curriculumId={params.id} />{" "}
          <a
            href={`/api/export/curriculum?id=${params.id}`}
            download
            className="rounded-lg border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
          >
            Export
          </a>{" "}
          <Link
            href={`/subjects/${data.subject_id}`}
            className="rounded-lg border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
          >
            {" "}
            Back to {data.subject_name}{" "}
          </Link>{" "}
        </div>{" "}
      </PageHeader>{" "}
      <div className="mb-6 flex items-center gap-3">
        {" "}
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: data.subject_color }}
        />{" "}
        <span className="text-sm text-muted">
          {" "}
          <Link
            href={`/subjects/${data.subject_id}`}
            className="text-interactive hover:underline"
          >
            {" "}
            {data.subject_name}{" "}
          </Link>{" "}
          {" ·"}{" "}
          <Link
            href={`/students/${data.child_id}`}
            className="text-interactive hover:underline"
          >
            {" "}
            {data.child_name}{" "}
          </Link>{" "}
          {" ·"} {data.children.length} student
          {data.children.length !== 1 ? "s" : ""} assigned{" "}
        </span>{" "}
      </div>{" "}
      {(data.start_date || data.actual_start_date) && (
        <div className="mb-6 flex flex-wrap gap-4 text-xs text-muted">
          {data.start_date && (
            <span>Planned: {data.start_date}{data.end_date ? ` \u2013 ${data.end_date}` : ""}</span>
          )}
          {data.actual_start_date && (
            <span>Actual: {data.actual_start_date}{data.actual_end_date ? ` \u2013 ${data.actual_end_date}` : ""}</span>
          )}
        </div>
      )}
      <LinkedBooklists
        curriculumId={params.id}
        linkedBooklists={linkedBooklists}
        allBooklists={allBooklists}
        isParent={user.role === "parent"}
      />
      {archivedCount > 0 && (
        <div className="mb-4 text-sm">
          {showArchived ? (
            <Link
              href={`/curricula/${params.id}/board`}
              className="text-interactive hover:underline"
            >
              Hide archived lessons
            </Link>
          ) : (
            <Link
              href={`/curricula/${params.id}/board?showArchived=true`}
              className="text-interactive hover:underline"
            >
              Show archived ({archivedCount})
            </Link>
          )}
        </div>
      )}
      {user.role === "parent" && (
        <div className="mb-4 flex items-center gap-2">
          <LessonTemplateManager
            curriculumId={data.id}
            lessonCount={data.lessons.length}
          />
          <AICurriculumPlanModal
            curriculumId={data.id}
            subjectName={data.subject_name}
          />
        </div>
      )}
      <CurriculumBoard
        curriculumId={data.id}
        curriculumName={data.name}
        subjectColor={data.subject_color}
        subjectName={data.subject_name}
        lessons={data.lessons}
        children={data.children}
        curriculumResources={data.curriculumResources}
        permissionLevel={user.permissionLevel}
        backgroundImage={data.background_image || null}
      />{" "}
    </div>
  );
}
