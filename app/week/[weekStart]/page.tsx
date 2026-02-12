import { getWeekLessons, getChildren } from "@/lib/queries/week";
import {
  getFullWeekDates,
  getFullWeekEnd,
  formatWeekLabel,
  parseDate,
  toDateStr,
} from "@/lib/utils/dates";
import { bumpOverdueLessons } from "@/lib/actions/lessons";
import WeekGrid from "@/components/week/WeekGrid";
import type { WeekLesson } from "@/lib/queries/week";
import { getExternalEventOccurrencesForRange } from "@/lib/queries/external-events";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function WeeklyBoardPage({
  params,
  searchParams,
}: {
  params: { weekStart: string };
  searchParams: { child?: string };
}) {
  const user = await getCurrentUser();
  const children = await getChildren(
    user.role === "parent" ? user.id : undefined,
  );
  const childId = searchParams.child || children[0]?.id;
  if (!childId) {
    return <p className="text-muted">No children found. Add a child first.</p>;
  }

  // Auto-bump overdue lessons
  const today = toDateStr(new Date());
  await bumpOverdueLessons(childId, today);

  const initialWeekStart = params.weekStart;
  const weekStarts = Array.from({ length: 6 }, (_, index) => {
    const d = parseDate(initialWeekStart);
    d.setDate(d.getDate() + index * 7);
    return toDateStr(d);
  });

  const firstWeekStart = weekStarts[0];
  const lastWeekStart = weekStarts[weekStarts.length - 1];
  const lastWeekEnd = getFullWeekEnd(lastWeekStart);
  const parentId = user.role === "parent" ? user.id : undefined;

  const [lessonsByWeek, externalEvents] = await Promise.all([
    Promise.all(
      weekStarts.map((weekStart) =>
        getWeekLessons(childId, weekStart, getFullWeekEnd(weekStart)),
      ),
    ),
    getExternalEventOccurrencesForRange(
      firstWeekStart,
      lastWeekEnd,
      childId,
      parentId,
    ),
  ]);

  const externalEventsByDate = new Map<string, typeof externalEvents>();
  for (const event of externalEvents) {
    const current = externalEventsByDate.get(event.date) || [];
    current.push(event);
    externalEventsByDate.set(event.date, current);
  }

  const weeks = weekStarts.map((weekStart, index) => {
    const lessons = lessonsByWeek[index];
    const dates = getFullWeekDates(weekStart);

    const byDate = new Map<
      string,
      Map<
        string,
        {
          subjectName: string;
          subjectColor: string | null;
          lessons: WeekLesson[];
        }
      >
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
        externalEvents: externalEventsByDate.get(date) || [],
      };
    });

    return { weekStart, label: formatWeekLabel(weekStart), days };
  });

  return <WeekGrid weeks={weeks} />;
}
