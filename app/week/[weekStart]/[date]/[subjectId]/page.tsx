import {
  getDaySubjectLessons,
  getChildren,
  getSubjectById,
} from "@/lib/queries/week";
import { formatWeekday, formatShortDate } from "@/lib/utils/dates";
import LessonCard from "@/components/week/LessonCard";
import Breadcrumbs from "@/components/week/Breadcrumbs";
import { getCurrentUser } from "@/lib/session";
export const dynamic = "force-dynamic";
export default async function SubjectLessonsPage({
  params,
  searchParams,
}: {
  params: { weekStart: string; date: string; subjectId: string };
  searchParams: { child?: string };
}) {
  const user = await getCurrentUser();
  const children = await getChildren(
    user.role === "parent" ? user.id : undefined,
  );
  const requestedChildId = searchParams.child;
  const childId = children.some((child) => child.id === requestedChildId)
    ? requestedChildId
    : children[0]?.id;
  if (!childId) {
    return <p className="text-muted">No children found.</p>;
  }
  const { date, subjectId } = params;
  const [lessons, subject] = await Promise.all([
    getDaySubjectLessons(childId, date, subjectId),
    getSubjectById(subjectId),
  ]);
  const subjectName = subject?.name || "Subject";
  const subjectColor = subject?.color || "#6366f1";
  return (
    <div>
      {" "}
      <div className="mb-4 flex items-center gap-3">
        {" "}
        <span
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: subjectColor }}
        />{" "}
        <h2 className="text-lg font-semibold text-primary">
          {" "}
          {subjectName} — {formatWeekday(date)}, {formatShortDate(date)}{" "}
        </h2>{" "}
      </div>{" "}
      {lessons.length === 0 ? (
        <p className="py-8 text-center text-muted">
          No lessons for this subject today.
        </p>
      ) : (
        <div className="space-y-3">
          {" "}
          {lessons.map((lesson) => (
            <LessonCard key={lesson.id} lesson={lesson} />
          ))}{" "}
        </div>
      )}{" "}
    </div>
  );
}
