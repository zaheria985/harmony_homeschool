export const dynamic = "force-dynamic";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import {
  getDashboardActivity,
  getDashboardStats,
  getUpcomingDueLessons,
} from "@/lib/queries/dashboard";
import { getCompletionStreaks } from "@/lib/queries/streaks";
import FamilyPulse from "@/components/dashboard/FamilyPulse";
import { getExternalEventOccurrencesForRange } from "@/lib/queries/external-events";
import { getAllChildren } from "@/lib/queries/students";
import { getCurrentUser } from "@/lib/session";
import LessonCompleteCheckbox from "@/components/lessons/LessonCompleteCheckbox";
import VikunjaSyncButton from "@/components/dashboard/VikunjaSyncButton";
import PendingApprovalsWidget from "@/components/dashboard/PendingApprovalsWidget";
import { getPendingCompletions } from "@/lib/actions/completions";
import { todayKey } from "@/lib/utils/timezone";
import { lazyBumpIfNoScheduler } from "@/lib/server/lesson-bump";
import { parseDate } from "@/lib/utils/dates";
type UpcomingItem = Record<string, string | number | null>;
type GroupedDay = { dayKey: string; dayLabel: string };
type ExternalEventItem = {
  event_id: string;
  date: string;
  title: string;
  color: string;
  children: { id: string; name: string }[];
};
function dayKeyFromDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { days?: string };
}) {
  const daysAhead = searchParams.days === "7" ? 7 : 3;
  const user = await getCurrentUser();
  const scopedChildId =
    user.role === "kid" ? user.childId || undefined : undefined;
  const parentId = user.role === "parent" ? user.id : undefined;
  const isParent = user.role === "parent" || user.permissionLevel === "full";

  const todayStr = todayKey();
  // Bumping is owned by the nightly cron, not page render. This fallback is a
  // no-op when CRON_SECRET is set, and runs at most once a day otherwise.
  await lazyBumpIfNoScheduler(todayStr);

  const [stats, upcoming, children, pendingCompletions, activity, streaks] =
    await Promise.all([
      getDashboardStats(parentId),
      getUpcomingDueLessons(daysAhead, scopedChildId, parentId),
      getAllChildren(parentId),
      isParent ? getPendingCompletions() : Promise.resolve([]),
      user.role === "kid"
        ? Promise.resolve(null)
        : getDashboardActivity(parentId),
      user.role === "kid" ? Promise.resolve([]) : getCompletionStreaks(parentId),
    ]);
  // Anchor the upcoming-days list to today in the app timezone, so the list
  // does not start on the wrong day when the container runs a different zone.
  const today = parseDate(todayStr);
  const nextDays: GroupedDay[] = Array.from({ length: daysAhead }, (_, offset) => {
    const date = new Date(today);
    date.setDate(today.getDate() + offset);
    const dayKey = dayKeyFromDate(date);
    return {
      dayKey,
      dayLabel: date.toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      }),
    };
  });
  const childrenById = new Map<string, string>();
  for (const child of children as Array<{ id: string; name: string }>) {
    childrenById.set(child.id, child.name);
  }
  const rangeStart = dayKeyFromDate(today);
  const rangeEnd = nextDays[nextDays.length - 1]?.dayKey || rangeStart;
  const externalEvents = (await getExternalEventOccurrencesForRange(
    rangeStart,
    rangeEnd,
    scopedChildId,
    parentId,
  )) as ExternalEventItem[];

  const grouped = new Map<
    string,
    Map<string, Map<string, Map<string, UpcomingItem[]>>>
  >();
  const eventsGrouped = new Map<string, Map<string, ExternalEventItem[]>>();
  for (const item of upcoming) {
    const childId = String(item.child_id || "");
    const dayKey = String(item.planned_date || "");
    const subjectName = String(item.subject_name || "Uncategorized");
    const courseName = String(item.curriculum_name || "Course");
    if (!childId || !dayKey) continue;
    if (!grouped.has(childId)) grouped.set(childId, new Map());
    const dayMap = grouped.get(childId)!;
    if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Map());
    const subjectMap = dayMap.get(dayKey)!;
    if (!subjectMap.has(subjectName)) subjectMap.set(subjectName, new Map());
    const courseMap = subjectMap.get(subjectName)!;
    if (!courseMap.has(courseName)) courseMap.set(courseName, []);
    courseMap.get(courseName)!.push(item);
  }
  for (const event of externalEvents) {
    const dayKey = event.date;
    const targetChildIds =
      scopedChildId && scopedChildId.length > 0
        ? [scopedChildId]
        : (event.children || []).map((child) => child.id);
    for (const childId of targetChildIds) {
      if (!eventsGrouped.has(childId)) eventsGrouped.set(childId, new Map());
      const childDayMap = eventsGrouped.get(childId)!;
      if (!childDayMap.has(dayKey)) childDayMap.set(dayKey, []);
      childDayMap.get(dayKey)!.push(event);
    }
  }
  const childrenList = Array.from(childrenById.entries())
    .map(([id, name]) => ({ id, name }))
    .filter((child) => !scopedChildId || child.id === scopedChildId)
    .sort((a, b) => a.name.localeCompare(b.name));
  const yearCompletionRate =
    stats.active_year_total_lessons > 0
      ? Math.round(
          (stats.active_year_completed_lessons /
            stats.active_year_total_lessons) *
            100,
        )
      : 0;
  // Families school year-round, so today is often outside every configured
  // school year. Say which year the number covers instead of reporting 0%.
  const schoolYear = stats.school_year as
    | { id: string; label: string; isCurrent: boolean; isUpcoming: boolean }
    | null;
  const yearStatLabel = schoolYear
    ? schoolYear.isCurrent
      ? "Year Completion Rate"
      : `${schoolYear.label} Completion Rate`
    : "Year Completion Rate";
  const yearStatSublabel = schoolYear
    ? `${stats.active_year_completed_lessons} of ${stats.active_year_total_lessons}`
    : "No school year set up yet";
  return (
    <div>
      {" "}
      <div className="flex items-center justify-between">
        <PageHeader title="Dashboard" />
        {process.env.VIKUNJA_URL && <VikunjaSyncButton />}
      </div>{" "}
      {user.role !== "kid" && (
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {" "}
          <StatCard
            label="Total Students"
            value={stats.total_students}
            color="primary"
          />{" "}
          <StatCard
            label={yearStatLabel}
            value={`${yearCompletionRate}%`}
            sublabel={yearStatSublabel}
            color="success"
          />{" "}
        </div>
      )}{" "}
      {user.role !== "kid" && (!schoolYear || !schoolYear.isCurrent) && (
        <div className="mb-6 rounded-xl border border-dashed border-light bg-surface-muted p-4 text-sm text-secondary">
          {schoolYear
            ? `Today falls outside ${schoolYear.label}${
                schoolYear.isUpcoming ? ", which hasn't started yet" : ", which has ended"
              }. Lessons scheduled now still work — they just won't count toward year totals until a school year covers them.`
            : "No school year is set up yet, so year totals and school-day scheduling have nothing to go on."}{" "}
          <Link
            href="/admin/calendar"
            className="font-medium text-interactive hover:underline"
          >
            {schoolYear ? "Set up the next school year →" : "Set up a school year →"}
          </Link>
        </div>
      )}{" "}
      {activity && (
        <div className="mb-6">
          <FamilyPulse
            yearLabel={activity.schoolYear?.label ?? null}
            progress={activity.progress}
            recentCompletions={activity.recentCompletions}
            reading={activity.reading}
            streaks={streaks}
            sinceDays={7}
          />
        </div>
      )}{" "}
      {isParent && pendingCompletions.length > 0 && (
        <div className="mb-6">
          <PendingApprovalsWidget pendingCompletions={pendingCompletions} />
        </div>
      )}
      <Card title="">
        <div className="flex items-center justify-between -mt-2 mb-4">
          <h3 className="text-sm font-semibold text-primary">Due in the Next {daysAhead} Days</h3>
          <div className="flex gap-1 rounded-lg bg-surface-muted p-1">
            <Link href="/dashboard?days=3"
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${daysAhead === 3 ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"}`}>
              3 Days
            </Link>
            <Link href="/dashboard?days=7"
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${daysAhead === 7 ? "bg-surface text-primary shadow-sm" : "text-muted hover:text-primary"}`}>
              7 Days
            </Link>
          </div>
        </div>
        {" "}
        <div className="space-y-5">
          {" "}
          {childrenList.map((child) => {
            const childMap = grouped.get(child.id) || new Map();
            const childEvents = eventsGrouped.get(child.id) || new Map();
            const hasAnythingDue = nextDays.some(
              (day) =>
                (childMap.get(day.dayKey)?.size || 0) > 0 ||
                (childEvents.get(day.dayKey)?.length || 0) > 0,
            );
            return (
              <section
                key={child.id}
                className="rounded-xl border border-light bg-surface-muted p-4"
              >
                {" "}
                <div className="mb-3 border-b border-light pb-2">
                  {" "}
                  {user.role === "kid" ? (
                    <span className="text-sm font-semibold text-interactive">
                      {child.name}
                    </span>
                  ) : (
                    <Link
                      href={`/students/${child.id}`}
                      className="text-sm font-semibold text-interactive hover:underline"
                    >
                      {" "}
                      {child.name}{" "}
                    </Link>
                  )}{" "}
                </div>{" "}
                {!hasAnythingDue ? (
                  <p className="rounded-lg border border-dashed border-light bg-surface p-3 text-sm text-muted">
                    {" "}
                    Nothing due{" "}
                  </p>
                ) : (
                  <div className={`grid gap-4 ${daysAhead === 7 ? "grid-cols-2 md:grid-cols-4 lg:grid-cols-7" : "lg:grid-cols-3"}`}>
                    {" "}
                    {nextDays.map((day) => {
                      const subjectMap =
                        (childMap.get(day.dayKey) as
                          | Map<string, Map<string, UpcomingItem[]>>
                          | undefined) ||
                        new Map<string, Map<string, UpcomingItem[]>>();
                      const dayEvents = childEvents.get(day.dayKey) || [];
                      return (
                        <div
                          key={`${child.id}-${day.dayKey}`}
                          className="rounded-xl border border-light bg-surface p-3"
                        >
                          {" "}
                          <h3 className="mb-2 text-sm font-semibold text-secondary">
                            {" "}
                            {day.dayLabel}{" "}
                          </h3>{" "}
                          {subjectMap.size === 0 && dayEvents.length === 0 ? (
                            <p className="py-2 text-sm text-muted">Nothing scheduled</p>
                          ) : (
                          <div className="space-y-3">
                            {dayEvents.length > 0 && (
                              <div className="space-y-1">
                                {dayEvents.map((event: ExternalEventItem) => (
                                  <div
                                    key={`${child.id}-${event.event_id}-${event.date}`}
                                    className="rounded border border-dashed border-light bg-surface-muted px-2 py-1"
                                  >
                                    <div className="flex items-center gap-1.5">
                                      <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ backgroundColor: event.color }}
                                      />
                                      <span className="text-[11px] font-medium text-secondary">
                                        🏫 {event.title}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                            {" "}
                            {Array.from(subjectMap.entries()).map(
                              ([subjectName, courseMap]: [
                                string,
                                Map<string, UpcomingItem[]>,
                              ]) => {
                                const subjectColor = String(
                                  courseMap.values().next().value?.[0]
                                    ?.subject_color || "#94a3b8",
                                );
                                return (
                                  <div
                                    key={`${child.id}-${day.dayKey}-${subjectName}`}
                                  >
                                    {" "}
                                    <div className="mb-1 flex items-center gap-1.5">
                                      {" "}
                                      <span
                                        className="h-2.5 w-2.5 rounded-full"
                                        style={{
                                          backgroundColor: subjectColor,
                                        }}
                                      />{" "}
                                      <span className="text-xs font-semibold text-secondary">
                                        {" "}
                                        {subjectName}{" "}
                                      </span>{" "}
                                    </div>{" "}
                                    <div className="ml-4 space-y-2">
                                      {" "}
                                      {Array.from(courseMap.entries()).map(
                                        ([courseName, items]: [
                                          string,
                                          UpcomingItem[],
                                        ]) => (
                                          <div
                                            key={`${child.id}-${day.dayKey}-${subjectName}-${courseName}`}
                                          >
                                            {" "}
                                            <Link
                                              href={`/curricula/${items[0]?.curriculum_id}`}
                                              className="text-[11px] text-interactive hover:underline"
                                            >
                                              {courseName}
                                            </Link>{" "}
                                            <ul className="mt-1 space-y-1">
                                              {" "}
                                              {items.map(
                                                (item: UpcomingItem) => (
                                                  <li key={String(item.id)}>
                                                    {" "}
                                                    <div className="flex items-center gap-2">
                                                      {" "}
                                                      <LessonCompleteCheckbox
                                                        lessonId={String(
                                                          item.id,
                                                        )}
                                                        childId={String(
                                                          item.child_id,
                                                        )}
                                                      />{" "}
                                                      <Link
                                                        href={`/lessons/${item.id}`}
                                                        className="text-xs font-medium text-interactive hover:underline"
                                                      >
                                                        {" "}
                                                        {String(
                                                          item.title,
                                                        )}{" "}
                                                      </Link>{" "}
                                                    </div>{" "}
                                                  </li>
                                                ),
                                              )}{" "}
                                            </ul>{" "}
                                          </div>
                                        ),
                                      )}{" "}
                                    </div>{" "}
                                  </div>
                                );
                              },
                            )}{" "}
                          </div>
                          )}{" "}
                        </div>
                      );
                    })}{" "}
                  </div>
                )}{" "}
              </section>
            );
          })}{" "}
        </div>{" "}
      </Card>{" "}
    </div>
  );
}
