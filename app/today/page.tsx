export const dynamic = "force-dynamic";
import Link from "next/link";
import { ClipboardCheck, AlertTriangle, Flame, BookOpen, TrendingUp } from "lucide-react";
import PageHeader from "@/components/ui/PageHeader";
import TodayBoard from "@/components/today/TodayBoard";
import KidDayBoard from "@/components/today/KidDayBoard";
import {
  getTodayLessons,
  groupLessonsByChild,
  groupLessonsBySubject,
  getWeekProgress,
  getRecentReadingMinutes,
  getOverdueCount,
} from "@/lib/queries/today";
import { getDashboardStats } from "@/lib/queries/dashboard";
import { getCompletionStreaks } from "@/lib/queries/streaks";
import { getPendingCompletions } from "@/lib/actions/completions";
import { getChildRoster, getAllChildren } from "@/lib/queries/students";
import { getCurrentUser } from "@/lib/session";
import { kidColorMap, kidColorFor } from "@/lib/utils/kid-colors";
import { todayKey } from "@/lib/utils/timezone";
import { parseDate } from "@/lib/utils/dates";
import { lazyBumpIfNoScheduler } from "@/lib/server/lesson-bump";

function longDate(dayKey: string) {
  return parseDate(dayKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default async function TodayPage() {
  const user = await getCurrentUser();
  const isKid = user.role === "kid";
  const scopedChildId = isKid ? user.childId || undefined : undefined;
  const parentId = user.role === "parent" ? user.id : undefined;
  const canApprove = user.role === "parent" || user.permissionLevel === "full";

  const dayKey = todayKey();
  // Bumping belongs to the nightly cron; this is the no-op fallback for
  // installs without CRON_SECRET set.
  await lazyBumpIfNoScheduler(dayKey);

  const [roster, lessons, streaks, pending, overdue] = await Promise.all([
    getChildRoster(),
    getTodayLessons(scopedChildId, parentId),
    getCompletionStreaks(parentId),
    canApprove ? getPendingCompletions() : Promise.resolve([]),
    getOverdueCount(scopedChildId, parentId),
  ]);

  if (isKid) {
    const index = roster.findIndex((child) => child.id === scopedChildId);
    const color = kidColorFor(index === -1 ? 0 : index);
    const streak =
      streaks.find((row) => row.child_id === scopedChildId)?.current ?? 0;
    return (
      <KidDayBoard lessons={lessons} color={color} streak={streak} />
    );
  }

  const [stats, weekProgress, reading, ownChildren] = await Promise.all([
    getDashboardStats(parentId),
    getWeekProgress(scopedChildId, parentId),
    getRecentReadingMinutes(scopedChildId, parentId),
    // Which children to show is an ownership question, so it comes from the
    // parent-scoped query. The unscoped roster is only for color assignment,
    // which has to stay stable across the whole app.
    getAllChildren(parentId),
  ]);

  const colors = kidColorMap(roster);
  const children = groupLessonsByChild(
    (ownChildren as Array<{ id: string; name: string }>).map((child) => ({
      id: child.id,
      name: child.name,
    })),
    lessons,
  );
  const subjects = groupLessonsBySubject(lessons);

  const doneToday = lessons.filter((lesson) => lesson.completed).length;
  const summary =
    lessons.length === 0
      ? "Nothing scheduled today"
      : `${lessons.length} ${lessons.length === 1 ? "lesson" : "lessons"} across ${children.length} ${children.length === 1 ? "kid" : "kids"} · ${doneToday} done`;

  const schoolYear = stats.school_year as
    | { id: string; label: string; isCurrent: boolean; isUpcoming: boolean }
    | null;
  const yearRate =
    stats.active_year_total_lessons > 0
      ? Math.round(
          (stats.active_year_completed_lessons /
            stats.active_year_total_lessons) *
            100,
        )
      : 0;
  const readingMinutes = reading.reduce((sum, row) => sum + row.minutes, 0);

  return (
    <div>
      <PageHeader title={longDate(dayKey)} subtitle={summary} />

      <div className="mb-5 flex flex-col gap-2">
        {pending.length > 0 && (
          <Link
            href="/approvals"
            className="flex items-center gap-2 rounded-xl border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-text)] transition-colors hover:brightness-[0.98]"
          >
            <ClipboardCheck size={16} />
            {pending.length} {pending.length === 1 ? "completion" : "completions"} to
            approve
            <span className="ml-auto text-xs">Review →</span>
          </Link>
        )}
        {overdue > 0 && (
          <Link
            href="/lessons/table?completion=incomplete"
            className="flex items-center gap-2 rounded-xl border border-[var(--error-border)] bg-[var(--error-bg)] px-3 py-2 text-sm text-[var(--error-text)] transition-colors hover:brightness-[0.98]"
          >
            <AlertTriangle size={16} />
            {overdue} overdue {overdue === 1 ? "lesson" : "lessons"}
            <span className="ml-auto text-xs">See them →</span>
          </Link>
        )}
        {(!schoolYear || !schoolYear.isCurrent) && (
          <div className="rounded-xl border border-dashed border-light bg-surface-muted px-3 py-2 text-sm text-secondary">
            {schoolYear
              ? `Today falls outside ${schoolYear.label}${
                  schoolYear.isUpcoming
                    ? ", which hasn't started yet"
                    : ", which has ended"
                }. Lessons scheduled now still work — they just won't count toward year totals.`
              : "No school year is set up yet, so year totals have nothing to go on."}{" "}
            <Link
              href="/admin/calendar"
              className="font-medium text-interactive hover:underline"
            >
              {schoolYear ? "Set up the next year →" : "Set up a school year →"}
            </Link>
          </div>
        )}
      </div>

      <TodayBoard children={children} subjects={subjects} colors={colors} />

      {weekProgress.length > 0 && (
        <section className="mt-5 rounded-card border border-light bg-surface p-4 shadow-warm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-medium uppercase tracking-wider text-muted">
              This week
            </h2>
            <Link
              href="/week"
              className="text-xs font-medium text-interactive hover:underline"
            >
              Open planner →
            </Link>
          </div>
          <div className="flex flex-col gap-2">
            {weekProgress.map((row) => {
              const percent =
                row.total > 0 ? Math.round((row.done / row.total) * 100) : 0;
              return (
                <div key={row.child_id} className="flex items-center gap-3">
                  <span
                    className="w-20 shrink-0 truncate text-xs font-medium"
                    style={{ color: colors[row.child_id]?.text }}
                  >
                    {row.child_name}
                  </span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-subtle">
                    <div
                      className="h-full rounded-full bg-[var(--interactive)]"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-xs text-tertiary">
                    {row.done}/{row.total}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip icon={<TrendingUp size={13} />}>
          {schoolYear ? `${schoolYear.label} ${yearRate}%` : `Year ${yearRate}%`}
        </Chip>
        {streaks
          .filter((row) => row.current > 0)
          .map((row) => (
            <Chip
              key={row.child_id}
              icon={<Flame size={13} className="text-[var(--accent-solid)]" />}
            >
              {row.child_name} {row.current}d streak
            </Chip>
          ))}
        <Chip icon={<BookOpen size={13} className="text-[var(--warning-solid)]" />}>
          Reading 7d: {readingMinutes} min
        </Chip>
      </div>
    </div>
  );
}

function Chip({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-light bg-surface px-3 py-1 text-xs text-tertiary">
      {icon}
      {children}
    </span>
  );
}
