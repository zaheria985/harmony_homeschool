import Link from "next/link";
import { getWeekLessons, getChildren } from "@/lib/queries/week";
import { formatWeekday, formatShortDate } from "@/lib/utils/dates";
import ProgressBar from "@/components/ui/ProgressBar";
import Badge from "@/components/ui/Badge";
import type { WeekLesson } from "@/lib/queries/week";

export const dynamic = "force-dynamic";

export default async function DailyViewPage({
  params,
  searchParams,
}: {
  params: { weekStart: string; date: string };
  searchParams: { child?: string };
}) {
  const children = await getChildren();
  const childId = searchParams.child || children[0]?.id;
  if (!childId) {
    return <p className="text-gray-500">No children found.</p>;
  }

  const { weekStart, date } = params;
  const lessons = await getWeekLessons(childId, date, date);
  const qs = `?child=${childId}`;

  // Group by subject
  const subjectMap = new Map<
    string,
    { subjectName: string; subjectColor: string | null; lessons: WeekLesson[] }
  >();
  for (const lesson of lessons) {
    let group = subjectMap.get(lesson.subject_id);
    if (!group) {
      group = {
        subjectName: lesson.subject_name,
        subjectColor: lesson.subject_color,
        lessons: [],
      };
      subjectMap.set(lesson.subject_id, group);
    }
    group.lessons.push(lesson);
  }

  const subjects = Array.from(subjectMap.entries());

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-gray-900">
        {formatWeekday(date)}, {formatShortDate(date)}
      </h2>
      {subjects.length === 0 ? (
        <p className="py-8 text-center text-gray-400">No lessons scheduled for this day.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map(([subjectId, group]) => {
            const completed = group.lessons.filter((l) => l.status === "completed").length;
            const total = group.lessons.length;
            const allDone = completed === total && total > 0;
            return (
              <Link
                key={subjectId}
                href={`/week/${weekStart}/${date}/${subjectId}${qs}`}
                className={`rounded-xl border p-4 transition-colors hover:border-primary-300 hover:shadow-sm ${
                  allDone ? "border-success-200 bg-success-50/30" : "border-gray-200 bg-white"
                }`}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: group.subjectColor || "#6366f1" }}
                  />
                  <span className="font-semibold text-gray-900">{group.subjectName}</span>
                </div>
                <div className="mb-3 space-y-1.5">
                  {group.lessons.map((lesson) => (
                    <div key={lesson.id} className="flex items-center gap-2 text-sm">
                      <span
                        className={`${
                          lesson.status === "completed" ? "text-gray-400 line-through" : "text-gray-700"
                        }`}
                      >
                        {lesson.title}
                      </span>
                      {lesson.status === "completed" && (
                        <Badge variant="success">Done</Badge>
                      )}
                      {lesson.status === "in_progress" && (
                        <Badge variant="warning">In Progress</Badge>
                      )}
                    </div>
                  ))}
                </div>
                <div className="text-xs text-gray-500">
                  {completed}/{total} complete
                </div>
                <div className="mt-1">
                  <ProgressBar
                    value={completed}
                    max={total}
                    color={allDone ? "success" : "primary"}
                    showLabel={false}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
