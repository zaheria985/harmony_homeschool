import pool from "@/lib/db";

export async function getLessonsForMonth(
  childId: string,
  year: number,
  month: number
) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const res = await pool.query(
    `SELECT
       l.id, l.title, l.status, l.planned_date,
       s.name AS subject_name, s.color AS subject_color
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     WHERE ca.child_id = $1
       AND l.planned_date >= $2::date
       AND l.planned_date < $3::date
     ORDER BY l.planned_date, l.order_index`,
    [childId, startDate, endDate]
  );
  return res.rows;
}

export async function getSchoolDaysConfig(yearId: string) {
  const days = await pool.query(
    `SELECT weekday FROM school_days WHERE school_year_id = $1`,
    [yearId]
  );
  const overrides = await pool.query(
    `SELECT date, type, reason FROM date_overrides WHERE school_year_id = $1`,
    [yearId]
  );
  return {
    weekdays: days.rows.map((r: { weekday: number }) => r.weekday),
    overrides: overrides.rows,
  };
}

export async function getLessonDetail(lessonId: string) {
  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date, l.order_index,
       cu.name AS curriculum_name, cu.id AS curriculum_id,
       s.name AS subject_name, s.color AS subject_color, s.id AS subject_id,
       ca.child_id,
       c.name AS child_name
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     LEFT JOIN children c ON c.id = ca.child_id
     WHERE l.id = $1
     LIMIT 1`,
    [lessonId]
  );
  if (!res.rows[0]) return null;

  const resources = await pool.query(
    `SELECT id, type, url, title, page_number FROM lesson_resources WHERE lesson_id = $1`,
    [lessonId]
  );

  const completion = await pool.query(
    `SELECT lc.id, lc.completed_at, lc.child_id
     FROM lesson_completions lc WHERE lc.lesson_id = $1`,
    [lessonId]
  );

  return {
    ...res.rows[0],
    resources: resources.rows,
    completion: completion.rows[0] || null,
  };
}

export async function getSubjectsForChild(childId: string) {
  const res = await pool.query(
    `SELECT DISTINCT s.id, s.name, s.color
     FROM subjects s
     JOIN curricula cu ON cu.subject_id = s.id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     WHERE ca.child_id = $1
     ORDER BY s.name`,
    [childId]
  );
  return res.rows;
}

export async function getCurriculaForSubject(subjectId: string) {
  const res = await pool.query(
    `SELECT c.id, c.name, c.description
     FROM curricula c WHERE c.subject_id = $1 ORDER BY c.order_index, c.name`,
    [subjectId]
  );
  return res.rows;
}

export async function getSchoolYears() {
  const res = await pool.query(
    `SELECT id, label, start_date, end_date FROM school_years ORDER BY start_date DESC`
  );
  return res.rows;
}
