import pool from "@/lib/db";

/**
 * Builds the "what's due today" summary that the morning cron pushes to Home
 * Assistant (or any webhook). Read-only — safe to call for a preview.
 */

export type ChildDigest = {
  childId: string;
  childName: string;
  dueToday: number;
  overdue: number;
  lessons: { title: string; course: string; overdue: boolean }[];
};

export type DailyDigest = {
  date: string;
  totalDueToday: number;
  totalOverdue: number;
  children: ChildDigest[];
  summary: string;
};

const MAX_LESSONS_PER_CHILD = 5;

export async function buildDailyDigest(today: string): Promise<DailyDigest> {
  const res = await pool.query(
    `SELECT
       c.id::text   AS child_id,
       c.name       AS child_name,
       l.title      AS lesson_title,
       cu.name      AS course_name,
       l.planned_date::text AS planned_date
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     WHERE l.archived = false
       AND l.status != 'completed'
       AND l.planned_date IS NOT NULL
       AND l.planned_date <= $1::date
       AND NOT EXISTS (
         SELECT 1 FROM lesson_completions lc
         WHERE lc.lesson_id = l.id AND lc.child_id = c.id
       )
     ORDER BY c.name, l.planned_date ASC, l.order_index ASC`,
    [today],
  );

  const byChild = new Map<string, ChildDigest>();

  for (const row of res.rows as {
    child_id: string;
    child_name: string;
    lesson_title: string;
    course_name: string;
    planned_date: string;
  }[]) {
    let entry = byChild.get(row.child_id);
    if (!entry) {
      entry = {
        childId: row.child_id,
        childName: row.child_name,
        dueToday: 0,
        overdue: 0,
        lessons: [],
      };
      byChild.set(row.child_id, entry);
    }

    const isOverdue = row.planned_date < today;
    if (isOverdue) entry.overdue += 1;
    else entry.dueToday += 1;

    if (entry.lessons.length < MAX_LESSONS_PER_CHILD) {
      entry.lessons.push({
        title: row.lesson_title,
        course: row.course_name,
        overdue: isOverdue,
      });
    }
  }

  const children = Array.from(byChild.values());
  const totalDueToday = children.reduce((sum, c) => sum + c.dueToday, 0);
  const totalOverdue = children.reduce((sum, c) => sum + c.overdue, 0);

  // A one-line summary the HA automation can drop straight into a notification.
  const summary =
    children.length === 0
      ? "Nothing scheduled today."
      : children
          .map((c) => {
            const parts = [`${c.dueToday} due`];
            if (c.overdue > 0) parts.push(`${c.overdue} overdue`);
            return `${c.childName}: ${parts.join(", ")}`;
          })
          .join(" · ");

  return { date: today, totalDueToday, totalOverdue, children, summary };
}
