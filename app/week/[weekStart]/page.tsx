import { getWeekLessons, getAllWeekLessons, getChildren } from "@/lib/queries/week";
import {
  getFullWeekDates,
  getFullWeekEnd,
  formatWeekLabel,
  parseDate,
  toDateStr,
} from "@/lib/utils/dates";
import { bumpOverdueLessons } from "@/lib/actions/lessons";
import { getWeeklyNotes } from "@/lib/actions/weekly-notes";
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
  const childParam = searchParams.child || children[0]?.id;
  const isAllKids = childParam === "all";
  if (!childParam) {
    return <p className="text-muted">No children found. Add a child first.</p>;
  }

  // Auto-bump overdue lessons (for each child when viewing all)
  const today = toDateStr(new Date());
  let bumpedCount = 0;
  if (isAllKids) {
    const results = await Promise.all(children.map((c) => bumpOverdueLessons(c.id, today)));
    bumpedCount = results.reduce((sum, r) => sum + (r && "bumped" in r ? (r.bumped ?? 0) : 0), 0);
  } else {
    const result = await bumpOverdueLessons(childParam, today);
    bumpedCount = result && "bumped" in result ? (result.bumped ?? 0) : 0;
  }

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
        isAllKids
          ? getAllWeekLessons(weekStart, getFullWeekEnd(weekStart))
          : getWeekLessons(childParam, weekStart, getFullWeekEnd(weekStart)),
      ),
    ),
    getExternalEventOccurrencesForRange(
      firstWeekStart,
      lastWeekEnd,
      isAllKids ? undefined : childParam,
      parentId,
    ),
  ]);
  const weeklyNotes = await getWeeklyNotes(weekStarts);

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
      // When viewing all kids, group by "ChildName - Subject" so lessons don't merge
      const groupKey = isAllKids && lesson.child_name
        ? `${lesson.child_name} - ${lesson.subject_name}`
        : lesson.subject_name;
      let subjectGroup = dateMap.get(groupKey);
      if (!subjectGroup) {
        subjectGroup = {
          subjectName: groupKey,
          subjectColor: lesson.subject_color,
          lessons: [],
        };
        dateMap.set(groupKey, subjectGroup);
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
            description: l.description,
            status: l.status,
            effective_status: l.effective_status,
            curriculum_id: l.curriculum_id,
            curriculum_name: l.curriculum_name,
            grade: l.grade,
            checklist_state: l.checklist_state,
          })),
        })),
        externalEvents: externalEventsByDate.get(date) || [],
      };
    });

    return { weekStart, label: formatWeekLabel(weekStart), days };
  });

  return <WeekGrid weeks={weeks} bumpedCount={bumpedCount} weeklyNotes={weeklyNotes} />;
}
