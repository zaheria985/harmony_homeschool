import pool from "@/lib/db";
import { todayKey } from "@/lib/utils/timezone";
import { computeStreak } from "@/lib/utils/streaks";
import { resolveActiveSchoolYear } from "@/lib/queries/school-year";

export type ChildStreak = {
  child_id: string;
  child_name: string;
  current: number;
  best: number;
};

/**
 * Per-child streak of school days with at least one completed lesson.
 *
 * Days are keyed on the lesson's planned_date, matching how attendance is
 * derived (lib/queries/attendance.ts) — a parent catching up on approvals over
 * the weekend should not rewrite which days the child did school.
 */
export async function getCompletionStreaks(parentId?: string): Promise<ChildStreak[]> {
  const today = todayKey();
  const year = await resolveActiveSchoolYear();

  const params: string[] = [];
  let ownership = "";
  if (parentId) {
    params.push(parentId);
    ownership = `WHERE EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = $${params.length} AND pc.child_id = c.id
    )`;
  }

  const childrenRes = await pool.query(
    `SELECT c.id, c.name FROM children c ${ownership} ORDER BY c.name`,
    params,
  );
  const children = childrenRes.rows as Array<{ id: string; name: string }>;
  if (children.length === 0) return [];

  const daysRes = await pool.query(
    `SELECT DISTINCT lc.child_id, l.planned_date::text AS date
     FROM lesson_completions lc
     JOIN lessons l ON l.id = lc.lesson_id
     WHERE l.planned_date IS NOT NULL
       AND l.planned_date > $1::date - interval '400 days'
       AND l.planned_date <= $1::date`,
    [today],
  );

  const byChild = new Map<string, Set<string>>();
  for (const row of daysRes.rows as Array<{ child_id: string; date: string }>) {
    if (!byChild.has(row.child_id)) byChild.set(row.child_id, new Set());
    byChild.get(row.child_id)!.add(row.date);
  }

  // School weekdays and holiday overrides come from the resolved year; without
  // one there is no calendar to judge against, so no streaks.
  let weekdays = new Set<number>();
  const overrides = new Map<string, "exclude" | "include">();
  if (year) {
    const [weekdayRes, overrideRes] = await Promise.all([
      pool.query(`SELECT weekday FROM school_days WHERE school_year_id = $1`, [year.id]),
      pool.query(
        `SELECT date::text AS date, type FROM date_overrides WHERE school_year_id = $1`,
        [year.id],
      ),
    ]);
    weekdays = new Set(
      (weekdayRes.rows as Array<{ weekday: number }>).map((r) => r.weekday),
    );
    for (const row of overrideRes.rows as Array<{
      date: string;
      type: "exclude" | "include";
    }>) {
      overrides.set(row.date, row.type);
    }
  }

  return children.map((child) => {
    const { current, best } = computeStreak(
      byChild.get(child.id) || new Set(),
      weekdays,
      overrides,
      today,
    );
    return { child_id: child.id, child_name: child.name, current, best };
  });
}
