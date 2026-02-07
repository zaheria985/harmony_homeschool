import { getWeekLessons, getChildren } from "@/lib/queries/week";
import { getFullWeekDates, getFullWeekEnd, toDateStr } from "@/lib/utils/dates";
import { bumpOverdueLessons } from "@/lib/actions/lessons";
import WeekGrid from "@/components/week/WeekGrid";
import type { WeekLesson } from "@/lib/queries/week";

export const dynamic = "force-dynamic";

export default async function WeeklyBoardPage({
  params,
  searchParams,
}: {
  params: { weekStart: string };
  searchParams: { child?: string };
}) {
  const children = await getChildren();
  const childId = searchParams.child || children[0]?.id;
  if (!childId) {
    return <p className="text-gray-500">No children found. Add a child first.</p>;
  }

  // Auto-bump overdue lessons
  const today = toDateStr(new Date());
  await bumpOverdueLessons(childId, today);

  const weekStart = params.weekStart;
  const weekEnd = getFullWeekEnd(weekStart);
  const lessons = await getWeekLessons(childId, weekStart, weekEnd);
  const dates = getFullWeekDates(weekStart);

  // Group lessons by date -> subject
  const byDate = new Map<
    string,
    Map<string, { subjectName: string; subjectColor: string | null; lessons: WeekLesson[] }>
  >();
  for (const date of dates) {
    byDate.set(date, new Map());
  }
  for (const lesson of lessons) {
    const dateStr = lesson.planned_date;
    let dateMap = byDate.get(dateStr);
    if (!dateMap) {
      dateMap = new Map();
      byDate.set(dateStr, dateMap);
    }
    let subjectGroup = dateMap.get(lesson.subject_name);
    if (!subjectGroup) {
      subjectGroup = {
        subjectName: lesson.subject_name,
        subjectColor: lesson.subject_color,
        lessons: [],
      };
      dateMap.set(lesson.subject_name, subjectGroup);
    }
    subjectGroup.lessons.push(lesson);
  }

  // Build serializable data for client component
  const days = dates.map((date) => {
    const dateMap = byDate.get(date) || new Map();
    return {
      date,
      subjects: Array.from(dateMap.values()).map((group) => ({
        subjectName: group.subjectName,
        subjectColor: group.subjectColor,
        lessons: group.lessons.map((l: WeekLesson) => ({
          id: l.id,
          title: l.title,
          status: l.status,
          curriculum_name: l.curriculum_name,
          grade: l.grade,
        })),
      })),
    };
  });

  return <WeekGrid days={days} />;
}
