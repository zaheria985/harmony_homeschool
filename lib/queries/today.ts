import pool from "@/lib/db";
import { todayKey } from "@/lib/utils/timezone";

/**
 * Queries behind the Today command center.
 *
 * Two rules carry through every statement here:
 *   - completion is per child, read from `lesson_completions`, never from
 *     `lessons.status` (a shared course would otherwise hide one sibling's
 *     work the moment the other finished it);
 *   - date columns are cast `::text`, because node-postgres hands back a JS
 *     Date otherwise and client components call string methods on it.
 */

export type TodayLesson = {
  id: string;
  title: string;
  planned_date: string;
  child_id: string;
  child_name: string;
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  curriculum_id: string;
  curriculum_name: string;
  completed: boolean;
  pending: boolean;
};

export type TodayChild = {
  id: string;
  name: string;
  lessons: TodayLesson[];
  done: number;
  total: number;
};

function ownershipFilter(params: (string | number)[], parentId?: string) {
  if (!parentId) return "";
  params.push(parentId);
  return `AND EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = $${params.length} AND pc.child_id = ca.child_id
    )`;
}

/**
 * Every lesson scheduled for today, per child, with its completion and
 * approval state already resolved.
 */
export async function getTodayLessons(
  childId?: string,
  parentId?: string,
): Promise<TodayLesson[]> {
  const params: (string | number)[] = [todayKey()];

  let childFilter = "";
  if (childId) {
    params.push(childId);
    childFilter = `AND ca.child_id = $${params.length}`;
  }
  const parentFilter = ownershipFilter(params, parentId);

  // DISTINCT: a course assigned to the same child across two school years
  // joins twice and would list each lesson (and its checkbox) twice.
  const res = await pool.query(
    `SELECT DISTINCT
       l.id,
       l.title,
       l.planned_date::text AS planned_date,
       c.id AS child_id,
       c.name AS child_name,
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color,
       cu.id AS curriculum_id,
       cu.name AS curriculum_name,
       EXISTS (
         SELECT 1 FROM lesson_completions lc
         WHERE lc.lesson_id = l.id AND lc.child_id = ca.child_id
       ) AS completed,
       EXISTS (
         SELECT 1 FROM pending_completions pend
         WHERE pend.lesson_id = l.id AND pend.child_id = ca.child_id
       ) AS pending
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     WHERE l.archived = false
       AND l.planned_date = $1::date
       ${childFilter}
       ${parentFilter}
     ORDER BY c.name, s.name, cu.name, l.title`,
    params,
  );
  return res.rows as TodayLesson[];
}

/** Today's lessons folded into one entry per child, in roster order. */
export function groupLessonsByChild(
  roster: { id: string; name: string }[],
  lessons: TodayLesson[],
): TodayChild[] {
  return roster.map((child) => {
    const own = lessons.filter((lesson) => lesson.child_id === child.id);
    return {
      id: child.id,
      name: child.name,
      lessons: own,
      done: own.filter((lesson) => lesson.completed).length,
      total: own.length,
    };
  });
}

export type TodaySubjectGroup = {
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  lessons: TodayLesson[];
};

/** The same lessons regrouped for families who teach a subject to everyone at once. */
export function groupLessonsBySubject(
  lessons: TodayLesson[],
): TodaySubjectGroup[] {
  const groups = new Map<string, TodaySubjectGroup>();
  for (const lesson of lessons) {
    let group = groups.get(lesson.subject_id);
    if (!group) {
      group = {
        subject_id: lesson.subject_id,
        subject_name: lesson.subject_name,
        subject_color: lesson.subject_color,
        lessons: [],
      };
      groups.set(lesson.subject_id, group);
    }
    group.lessons.push(lesson);
  }
  return Array.from(groups.values()).sort((a, b) =>
    a.subject_name.localeCompare(b.subject_name),
  );
}

export type WeekProgressRow = {
  child_id: string;
  child_name: string;
  total: number;
  done: number;
};

/**
 * Per-child counts for the seven days starting Monday of the current week.
 * Feeds the slim "this week" strip under the kid columns.
 */
export async function getWeekProgress(
  childId?: string,
  parentId?: string,
): Promise<WeekProgressRow[]> {
  const params: (string | number)[] = [todayKey()];

  let childFilter = "";
  if (childId) {
    params.push(childId);
    childFilter = `AND ca.child_id = $${params.length}`;
  }
  const parentFilter = ownershipFilter(params, parentId);

  const res = await pool.query(
    `WITH bounds AS (
       SELECT
         date_trunc('week', $1::date)::date AS week_start,
         (date_trunc('week', $1::date)::date + 6) AS week_end
     ),
     scoped AS (
       SELECT DISTINCT
         l.id AS lesson_id,
         c.id AS child_id,
         c.name AS child_name,
         EXISTS (
           SELECT 1 FROM lesson_completions lc
           WHERE lc.lesson_id = l.id AND lc.child_id = ca.child_id
         ) AS completed
       FROM lessons l
       JOIN curricula cu ON cu.id = l.curriculum_id
       JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
       JOIN children c ON c.id = ca.child_id
       CROSS JOIN bounds b
       WHERE l.archived = false
         AND l.planned_date >= b.week_start
         AND l.planned_date <= b.week_end
         ${childFilter}
         ${parentFilter}
     )
     SELECT
       child_id,
       child_name,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE completed)::int AS done
     FROM scoped
     GROUP BY child_id, child_name
     ORDER BY child_name`,
    params,
  );
  return res.rows as WeekProgressRow[];
}

export type ReadingSummaryRow = {
  child_id: string;
  minutes: number;
};

/** Minutes read per child over the last seven days, for the year chips. */
export async function getRecentReadingMinutes(
  childId?: string,
  parentId?: string,
): Promise<ReadingSummaryRow[]> {
  const params: (string | number)[] = [todayKey()];

  let childFilter = "";
  if (childId) {
    params.push(childId);
    childFilter = `AND rl.child_id = $${params.length}`;
  }
  let parentFilter = "";
  if (parentId) {
    params.push(parentId);
    parentFilter = `AND EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = $${params.length} AND pc.child_id = rl.child_id
    )`;
  }

  const res = await pool.query(
    `SELECT rl.child_id, COALESCE(SUM(rl.minutes_read), 0)::int AS minutes
     FROM reading_log rl
     WHERE rl.date > $1::date - INTERVAL '7 days'
       AND rl.date <= $1::date
       ${childFilter}
       ${parentFilter}
     GROUP BY rl.child_id`,
    params,
  );
  return res.rows as ReadingSummaryRow[];
}

/** Count of lessons whose planned date has passed and that nobody finished. */
export async function getOverdueCount(
  childId?: string,
  parentId?: string,
): Promise<number> {
  const params: (string | number)[] = [todayKey()];

  let childFilter = "";
  if (childId) {
    params.push(childId);
    childFilter = `AND ca.child_id = $${params.length}`;
  }
  const parentFilter = ownershipFilter(params, parentId);

  const res = await pool.query(
    `SELECT COUNT(*)::int AS overdue
     FROM (
       SELECT DISTINCT l.id, ca.child_id
       FROM lessons l
       JOIN curricula cu ON cu.id = l.curriculum_id
       JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
       WHERE l.archived = false
         AND l.planned_date < $1::date
         AND NOT EXISTS (
           SELECT 1 FROM lesson_completions lc
           WHERE lc.lesson_id = l.id AND lc.child_id = ca.child_id
         )
         ${childFilter}
         ${parentFilter}
     ) AS overdue_rows`,
    params,
  );
  return Number(res.rows[0]?.overdue ?? 0);
}
