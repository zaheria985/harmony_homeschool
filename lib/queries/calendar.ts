import pool from "@/lib/db";

export async function getLessonsForMonth(
  childId: string,
  year: number,
  month: number,
  viewMode: "all" | "completed" | "planned" = "planned",
  parentId?: string
) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const params: (string | number)[] = [startDate, endDate];
  const conditions: string[] = [];

  if (viewMode === "completed") {
    conditions.push("l.status = 'completed'");
    conditions.push("lc.completed_at IS NOT NULL");
    conditions.push("lc.completed_at::date >= $1::date");
    conditions.push("lc.completed_at::date < $2::date");
  } else if (viewMode === "planned") {
    conditions.push("l.status != 'completed'");
    conditions.push("l.planned_date IS NOT NULL");
    conditions.push("l.planned_date >= $1::date");
    conditions.push("l.planned_date < $2::date");
  } else {
    conditions.push(`(
      (l.status = 'completed' AND lc.completed_at IS NOT NULL AND lc.completed_at::date >= $1::date AND lc.completed_at::date < $2::date)
      OR
      (l.status != 'completed' AND l.planned_date IS NOT NULL AND l.planned_date >= $1::date AND l.planned_date < $2::date)
    )`);
  }

  if (childId) {
    conditions.push(`ca.child_id = $${params.length + 1}`);
    params.push(childId);
  }

  if (parentId) {
    conditions.push(`EXISTS (SELECT 1 FROM parent_children pc WHERE pc.parent_id = $${params.length + 1} AND pc.child_id = ca.child_id)`);
    params.push(parentId);
  }

  const res = await pool.query(
    `SELECT
       l.id,
       l.title,
       l.status,
       l.planned_date,
       lc.completed_at,
       CASE
         WHEN l.status = 'completed' AND lc.completed_at IS NOT NULL THEN lc.completed_at::date
         ELSE l.planned_date
       END AS display_date,
       s.name AS subject_name, s.color AS subject_color,
       cu.name AS curriculum_name,
       c.name AS child_name,
       s.id AS subject_id
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     LEFT JOIN lesson_completions lc
       ON lc.lesson_id = l.id
      AND lc.child_id = ca.child_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY display_date, s.name, cu.name, l.order_index`,
    params
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

export async function getLessonDetail(lessonId: string, childId?: string) {
  const childJoin = childId ? "JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id" : "LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id";
  const childWhere = childId ? "AND ca.child_id = $2" : "";
  const params: string[] = [lessonId];
  if (childId) params.push(childId);

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
      ${childJoin}
      LEFT JOIN children c ON c.id = ca.child_id
      WHERE l.id = $1
      ${childWhere}
      LIMIT 1`,
    params
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

export async function getCurriculaForSubjectForChild(subjectId: string, childId: string) {
  const res = await pool.query(
    `SELECT DISTINCT c.id, c.name, c.description
     FROM curricula c
     JOIN curriculum_assignments ca ON ca.curriculum_id = c.id
     WHERE c.subject_id = $1 AND ca.child_id = $2
     ORDER BY c.order_index, c.name`,
    [subjectId, childId]
  );
  return res.rows;
}

export async function getSchoolYears() {
  const res = await pool.query(
    `SELECT id, label, start_date, end_date FROM school_years ORDER BY start_date DESC`
  );
  return res.rows;
}

export async function getSemesterOverview(
  startMonth: string,
  months: number,
  childId?: string,
  parentId?: string
) {
  const params: (string | number)[] = [startMonth + "-01", months];
  const conditions: string[] = [
    "l.planned_date >= $1::date",
    "l.planned_date < ($1::date + ($2 || ' months')::interval)",
  ];

  if (childId) {
    conditions.push(`ca.child_id = $${params.length + 1}`);
    params.push(childId);
  }

  if (parentId) {
    conditions.push(
      `EXISTS (SELECT 1 FROM parent_children pc WHERE pc.parent_id = $${params.length + 1} AND pc.child_id = ca.child_id)`
    );
    params.push(parentId);
  }

  const res = await pool.query(
    `SELECT l.planned_date::text AS date,
            COUNT(*)::int AS total,
            COUNT(lc.id)::int AS completed
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc
       ON lc.lesson_id = l.id AND lc.child_id = ca.child_id
     WHERE ${conditions.join(" AND ")}
     GROUP BY l.planned_date
     ORDER BY l.planned_date`,
    params
  );
  return res.rows as { date: string; total: number; completed: number }[];
}
