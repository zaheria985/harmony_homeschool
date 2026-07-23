import { revalidatePath } from "next/cache";
import pool from "@/lib/db";
import {
  addDays,
  formatDateKey,
  nextValidSchoolDate,
  parseDateKey,
} from "@/lib/utils/school-dates";

/**
 * Core overdue-lesson bumping logic.
 *
 * This lives outside `lib/actions/` on purpose. Every export of a `"use server"`
 * module becomes a callable POST endpoint, so an unauthenticated variant cannot
 * live there. Callers are responsible for their own authorization:
 *
 *   - `lib/actions/lessons.ts` wraps these behind `requireParent()`
 *   - `app/api/cron/bump-lessons/route.ts` is gated by `CRON_SECRET`
 */

function revalidateAll() {
  for (const route of [
    "/lessons",
    "/week",
    "/calendar",
    "/dashboard",
    "/subjects",
    "/curricula",
    "/grades",
    "/students",
    "/reports",
    "/resources",
    "/admin",
  ]) {
    revalidatePath(route);
  }
}

/**
 * Cheap pre-check: does this child have anything worth bumping?
 *
 * The full routine issues a query per curriculum assignment, so on a typical
 * day — when nothing is overdue — this one query replaces dozens.
 */
async function hasOverdueLessons(
  childId: string,
  today: string,
  includeToday: boolean
): Promise<boolean> {
  const comparison = includeToday ? "<=" : "<";
  const res = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM lessons l
       JOIN curriculum_assignments ca ON ca.curriculum_id = l.curriculum_id
       WHERE ca.child_id = $1
         AND l.status != 'completed'
         AND l.planned_date IS NOT NULL
         AND l.planned_date ${comparison} $2::date
     ) AS overdue`,
    [childId, today]
  );
  return Boolean(res.rows[0]?.overdue);
}

/** Move overdue incomplete lessons for one child forward. Idempotent. */
export async function bumpOverdueLessonsCore(
  childId: string,
  today: string,
  includeToday = false
): Promise<number> {
  if (!(await hasOverdueLessons(childId, today, includeToday))) return 0;

  const assignmentsRes = await pool.query(
    `SELECT
       ca.id,
       ca.curriculum_id,
       ca.school_year_id,
       COALESCE(
         NULLIF((
           SELECT ARRAY_AGG(cad.weekday ORDER BY cad.weekday)
           FROM curriculum_assignment_days cad
           WHERE cad.assignment_id = ca.id
         ), '{}'),
         (
           SELECT ARRAY_AGG(sd.weekday ORDER BY sd.weekday)
           FROM school_days sd
           WHERE sd.school_year_id = ca.school_year_id
         )
       ) AS weekdays
     FROM curriculum_assignments ca
     WHERE ca.child_id = $1`,
    [childId]
  );

  let bumped = 0;

  // Process each curriculum assignment independently so rescheduling preserves
  // the assignment's weekday/override constraints.
  for (const assignment of assignmentsRes.rows as {
    id: string;
    curriculum_id: string;
    school_year_id: string;
    weekdays: number[] | null;
  }[]) {
    const weekdays = assignment.weekdays || [];
    if (weekdays.length === 0) continue;

    const lessonsRes = await pool.query(
      `SELECT l.id, l.planned_date::text AS planned_date, l.order_index
       FROM lessons l
       WHERE l.curriculum_id = $1
         AND l.status != 'completed'
         AND l.planned_date IS NOT NULL
       ORDER BY l.planned_date ASC, l.order_index ASC, l.id ASC`,
      [assignment.curriculum_id]
    );

    if (lessonsRes.rows.length === 0) continue;

    // We only reschedule the first overdue lesson and everything after it,
    // preserving order while moving the sequence forward to valid school days.
    const firstAffectedIndex = (lessonsRes.rows as { planned_date: string }[]).findIndex((lesson) =>
      includeToday ? lesson.planned_date <= today : lesson.planned_date < today
    );

    if (firstAffectedIndex < 0) continue;

    const overridesRes = await pool.query(
      `SELECT date::text, type
       FROM date_overrides
       WHERE school_year_id = $1`,
      [assignment.school_year_id]
    );
    const overrides = new Map<string, "exclude" | "include">();
    for (const row of overridesRes.rows as { date: string; type: "exclude" | "include" }[]) {
      overrides.set(row.date, row.type);
    }

    const weekdaySet = new Set<number>(weekdays);
    let cursor = parseDateKey(includeToday ? formatDateKey(addDays(parseDateKey(today), 1)) : today);
    const affected = lessonsRes.rows.slice(firstAffectedIndex) as Array<{
      id: string;
      planned_date: string;
      order_index: number;
    }>;
    const updates: Array<{ id: string; plannedDate: string }> = [];

    for (const lesson of affected) {
      const nextDate = nextValidSchoolDate(cursor, weekdaySet, overrides);
      const nextDateKey = formatDateKey(nextDate);
      cursor = addDays(nextDate, 1);

      if (lesson.planned_date === nextDateKey) continue;
      updates.push({ id: lesson.id, plannedDate: nextDateKey });
    }

    if (updates.length > 0) {
      const ids = updates.map((update) => update.id);
      const dates = updates.map((update) => update.plannedDate);
      const updateRes = await pool.query(
        `UPDATE lessons AS l
         SET planned_date = u.planned_date::date
         FROM (
           SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::text[]) AS planned_date
         ) AS u
         WHERE l.id = u.id
           AND l.planned_date IS DISTINCT FROM u.planned_date::date`,
        [ids, dates]
      );
      bumped += updateRes.rowCount || 0;
    }
  }

  if (bumped > 0) {
    revalidateAll();
  }

  return bumped;
}

/** Bump overdue lessons for every child. */
export async function bumpOverdueLessonsForAllCore(
  today: string,
  includeToday = true
): Promise<number> {
  const childrenRes = await pool.query("SELECT id FROM children");
  let bumped = 0;

  for (const row of childrenRes.rows as { id: string }[]) {
    bumped += await bumpOverdueLessonsCore(row.id, today, includeToday);
  }

  return bumped;
}

/**
 * Fallback for deployments with no scheduler.
 *
 * Bumping is normally owned by the nightly cron. When CRON_SECRET is unset the
 * cron sidecar disables itself, so without this nothing would ever bump —
 * a silent regression. This runs at most once per day per process, and the
 * EXISTS pre-check above makes the no-op case a single query.
 *
 * Deliberately never throws: a failed bump must not break page rendering.
 */
let lastLazyBumpDay: string | null = null;

export async function lazyBumpIfNoScheduler(today: string): Promise<void> {
  if (process.env.CRON_SECRET) return; // the cron owns it
  if (lastLazyBumpDay === today) return;

  // Set before awaiting so concurrent requests do not all pile in.
  lastLazyBumpDay = today;

  try {
    const bumped = await bumpOverdueLessonsForAllCore(today, false);
    if (bumped > 0) {
      console.log(`[lesson-bump] lazy fallback moved ${bumped} lesson(s); set CRON_SECRET to use the scheduler instead`);
    }
  } catch (err) {
    lastLazyBumpDay = null; // allow a retry on the next request
    console.error("[lesson-bump] lazy fallback failed:", err);
  }
}
