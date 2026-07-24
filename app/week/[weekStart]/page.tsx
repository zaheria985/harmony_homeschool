import { getWeekLessons, getAllWeekLessons, getChildren } from "@/lib/queries/week";
import {
  getFullWeekDates,
  getFullWeekEnd,
  formatWeekLabel,
  parseDate,
  toDateStr,
} from "@/lib/utils/dates";
import { todayKey } from "@/lib/utils/timezone";
import { lazyBumpIfNoScheduler } from "@/lib/server/lesson-bump";
import { getWeeklyNotes } from "@/lib/actions/weekly-notes";
import WeekGrid from "@/components/week/WeekGrid";
import MaterialsPanel, {
  type PanelMaterial,
} from "@/components/week/MaterialsPanel";
import KidWeekList from "@/components/week/KidWeekList";
import type { WeekLesson } from "@/lib/queries/week";
import { getExternalEventOccurrencesForRange } from "@/lib/queries/external-events";
import { getUpcomingPrepMaterials } from "@/lib/queries/prep";
import { getChildRoster } from "@/lib/queries/students";
import { kidColorFor } from "@/lib/utils/kid-colors";
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
  const isKid = user.role === "kid";
  const children = await getChildren(
    user.role === "parent" ? user.id : undefined,
  );
  // A kid only ever sees their own week, whatever the query string says.
  const childParam = isKid
    ? user.childId || ""
    : searchParams.child || children[0]?.id;
  const isAllKids = !isKid && childParam === "all";
  if (!childParam) {
    return <p className="text-muted">No children found. Add a child first.</p>;
  }

  // Bumping is owned by the nightly cron, not page render. This fallback is a
  // no-op when CRON_SECRET is set, and runs at most once a day otherwise.
  await lazyBumpIfNoScheduler(todayKey());

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

  // getWeeklyNotes has no dependency on the other two, so it belongs in the
  // same batch rather than adding a serial round-trip after it.
  const [lessonsByWeek, externalEvents, weeklyNotes] = await Promise.all([
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
    getWeeklyNotes(weekStarts),
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

  if (isKid) {
    const roster = await getChildRoster();
    const index = roster.findIndex((child) => child.id === childParam);
    const thisWeek = weeks[0];
    const previous = parseDate(initialWeekStart);
    previous.setDate(previous.getDate() - 7);
    const next = parseDate(initialWeekStart);
    next.setDate(next.getDate() + 7);
    return (
      <KidWeekList
        label={thisWeek.label}
        color={kidColorFor(index === -1 ? 0 : index)}
        previousWeek={`/week/${toDateStr(previous)}`}
        nextWeek={`/week/${toDateStr(next)}`}
        days={thisWeek.days.map((day) => ({
          date: day.date,
          lessons: day.subjects.flatMap((subject) =>
            subject.lessons.map((lesson: WeekLesson) => ({
              id: lesson.id,
              title: lesson.title,
              subject_name: subject.subjectName,
              subject_color: subject.subjectColor,
              completed:
                (lesson.effective_status || lesson.status) === "completed",
            })),
          ),
        }))}
      />
    );
  }

  const materials = (await getUpcomingPrepMaterials(
    7,
    isAllKids ? undefined : childParam,
  )) as PanelMaterial[];

  return (
    <>
      <MaterialsPanel materials={materials} />
      <WeekGrid weeks={weeks} weeklyNotes={weeklyNotes} allChildren={children} />
    </>
  );
}
