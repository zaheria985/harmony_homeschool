import pool from "@/lib/db";

export interface WeekLesson {
  id: string;
  title: string;
  description: string | null;
  status: string;
  planned_date: string;
  curriculum_id: string;
  curriculum_name: string;
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  grade: number | null;
  checklist_state: Record<string, boolean> | null;
  child_name?: string;
}

/**
 * All lessons for a child within a date range, ordered by date then subject.
 * No resources JOIN for performance — Level 1 & 2 don't need them.
 */
export async function getWeekLessons(
  childId: string,
  weekStart: string,
  weekEnd: string
): Promise<WeekLesson[]> {
  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date::text,
       l.checklist_state,
       cu.id AS curriculum_id, cu.name AS curriculum_name,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       lc.grade
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
     WHERE EXISTS (
       SELECT 1
       FROM curriculum_assignments ca
       WHERE ca.curriculum_id = cu.id AND ca.child_id = $1
     )
       AND l.planned_date >= $2::date
       AND l.planned_date <= $3::date
     ORDER BY l.planned_date, s.name, l.order_index`,
    [childId, weekStart, weekEnd]
  );
  return res.rows;
}

/**
 * All lessons for ALL children within a date range.
 */
export async function getAllWeekLessons(
  weekStart: string,
  weekEnd: string
): Promise<WeekLesson[]> {
  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date::text,
       l.checklist_state,
       cu.id AS curriculum_id, cu.name AS curriculum_name,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       c.name AS child_name,
       lc.grade
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = ca.child_id
     WHERE l.planned_date >= $1::date
       AND l.planned_date <= $2::date
     ORDER BY l.planned_date, c.name, s.name, l.order_index`,
    [weekStart, weekEnd]
  );
  return res.rows;
}

export interface DaySubjectLesson {
  id: string;
  title: string;
  description: string | null;
  status: string;
  planned_date: string;
  order_index: number;
  curriculum_id: string;
  curriculum_name: string;
  subject_name: string;
  subject_color: string | null;
  grade: number | null;
  completion_notes: string | null;
  completed_at: string | null;
  completion_id: string | null;
  child_id: string;
  resources: LessonResource[];
}

export interface LessonResource {
  id: string;
  type: string;
  url: string;
  title: string | null;
  page_number: number | null;
}

/**
 * Full lessons + resources for a single subject on a single day (Level 3).
 */
export async function getDaySubjectLessons(
  childId: string,
  date: string,
  subjectId: string
): Promise<DaySubjectLesson[]> {
  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date::text,
       l.order_index,
       cu.id AS curriculum_id, cu.name AS curriculum_name,
       s.name AS subject_name, s.color AS subject_color,
       ca.child_id,
       lc.id AS completion_id, lc.grade, lc.notes AS completion_notes, lc.completed_at
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
     WHERE ca.child_id = $1
       AND l.planned_date = $2::date
       AND s.id = $3
     ORDER BY l.order_index`,
    [childId, date, subjectId]
  );

  // Fetch resources for all lessons in one query
  if (res.rows.length === 0) return [];
  const lessonIds = res.rows.map((r: { id: string }) => r.id);
  const resourceRes = await pool.query(
    `SELECT id, lesson_id, type, url, title, page_number
     FROM lesson_resources
     WHERE lesson_id = ANY($1)
     ORDER BY id`,
    [lessonIds]
  );

  const resourceMap = new Map<string, LessonResource[]>();
  for (const r of resourceRes.rows) {
    const list = resourceMap.get(r.lesson_id) || [];
    list.push({ id: r.id, type: r.type, url: r.url, title: r.title, page_number: r.page_number });
    resourceMap.set(r.lesson_id, list);
  }

  return res.rows.map((row: Record<string, unknown>) => ({
    ...row,
    resources: resourceMap.get(row.id as string) || [],
  })) as DaySubjectLesson[];
}

/**
 * Get the active school year containing the given date.
 */
export async function getActiveSchoolYear(date: string) {
  const res = await pool.query(
    `SELECT id, label, start_date::text, end_date::text
     FROM school_years
     WHERE start_date <= $1::date AND end_date >= $1::date
     LIMIT 1`,
    [date]
  );
  return res.rows[0] || null;
}

/**
 * Get school days (weekday numbers) and date overrides for a school year.
 */
export async function getSchoolDaysConfig(schoolYearId: string) {
  const [daysRes, overridesRes] = await Promise.all([
    pool.query(
      `SELECT weekday FROM school_days WHERE school_year_id = $1`,
      [schoolYearId]
    ),
    pool.query(
      `SELECT date::text, type FROM date_overrides WHERE school_year_id = $1`,
      [schoolYearId]
    ),
  ]);
  return {
    weekdays: daysRes.rows.map((r: { weekday: number }) => r.weekday),
    overrides: overridesRes.rows as { date: string; type: "exclude" | "include" }[],
  };
}

/**
 * Get all children (simple list for the selector).
 */
export async function getChildren(parentId?: string) {
  const params: string[] = [];
  const join = parentId ? "JOIN parent_children pc ON pc.child_id = c.id" : "";
  const where = parentId ? "WHERE pc.parent_id = $1" : "";
  if (parentId) params.push(parentId);

  const res = await pool.query(
    `SELECT c.id, c.name
     FROM children c
     ${join}
     ${where}
     ORDER BY c.name`,
    params
  );
  return res.rows as { id: string; name: string }[];
}

/**
 * Get subject info by ID.
 */
export async function getSubjectById(subjectId: string) {
  const res = await pool.query(
    `SELECT id, name, color FROM subjects WHERE id = $1`,
    [subjectId]
  );
  return res.rows[0] as { id: string; name: string; color: string | null } | undefined;
}
