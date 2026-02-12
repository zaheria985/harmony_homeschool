import pool from "@/lib/db";

export async function getActiveSchoolYear() {
  const res = await pool.query(
    `SELECT id, label, start_date::text AS start_date, end_date::text AS end_date
     FROM school_years
     WHERE CURRENT_DATE BETWEEN start_date AND end_date
     ORDER BY start_date DESC
     LIMIT 1`
  );
  return res.rows[0] || null;
}

export async function getAllChildren(parentId?: string) {
  const params: string[] = [];
  const ownershipJoin = parentId
    ? "JOIN parent_children pc ON pc.child_id = c.id"
    : "";
  const ownershipWhere = parentId ? "WHERE pc.parent_id = $1" : "";
  if (parentId) params.push(parentId);

  const res = await pool.query(`
    SELECT
      c.id, c.name, c.emoji, c.banner_url, c.created_at,
      COUNT(DISTINCT s.id)::int AS subject_count,
      COUNT(DISTINCT l.id)::int AS total_lessons,
      COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS completed_lessons
    FROM children c
    ${ownershipJoin}
    LEFT JOIN curriculum_assignments ca ON ca.child_id = c.id
    LEFT JOIN curricula cu ON cu.id = ca.curriculum_id
    LEFT JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    ${ownershipWhere}
    GROUP BY c.id, c.name, c.emoji, c.banner_url, c.created_at
    ORDER BY c.name
  `, params);
  return res.rows;
}

export async function getChildById(id: string) {
  const res = await pool.query(
    `SELECT id, name, emoji, banner_url, created_at FROM children WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function getChildProgress(childId: string, yearId?: string) {
  const yearFilter = yearId
    ? "AND ca.school_year_id = $2"
    : "AND ca.school_year_id IN (SELECT id FROM school_years WHERE CURRENT_DATE BETWEEN start_date AND end_date)";
  const params: string[] = [childId];
  if (yearId) params.push(yearId);

  const res = await pool.query(
    `SELECT
       COUNT(DISTINCT l.id)::int AS total_lessons,
       COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS completed,
       COUNT(DISTINCT CASE WHEN l.status = 'in_progress' THEN l.id END)::int AS in_progress,
       COUNT(DISTINCT CASE WHEN l.status = 'planned' THEN l.id END)::int AS planned,
       COALESCE(AVG(lc.grade), 0)::numeric(5,2) AS avg_grade
     FROM curriculum_assignments ca
     JOIN curricula cu ON cu.id = ca.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN lessons l ON l.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
     WHERE ca.child_id = $1 ${yearFilter}`,
    params
  );
  return res.rows[0];
}

export async function getChildSubjects(childId: string, yearId?: string) {
  const yearFilter = yearId
    ? "AND ca.school_year_id = $2"
    : "AND ca.school_year_id IN (SELECT id FROM school_years WHERE CURRENT_DATE BETWEEN start_date AND end_date)";
  const params: string[] = [childId];
  if (yearId) params.push(yearId);

  const res = await pool.query(
    `SELECT
       s.id, s.name, s.color,
       COUNT(DISTINCT l.id)::int AS total_lessons,
       COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS completed_lessons,
       COALESCE(AVG(lc.grade), 0)::numeric(5,2) AS avg_grade
     FROM curriculum_assignments ca
     JOIN curricula cu ON cu.id = ca.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN lessons l ON l.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
     WHERE ca.child_id = $1 ${yearFilter}
     GROUP BY s.id, s.name, s.color
     ORDER BY s.name`,
    params
  );
  return res.rows;
}

export async function getCompletedCurricula(childId: string) {
  const res = await pool.query(
    `SELECT
       cu.id AS curriculum_id,
       cu.name AS curriculum_name,
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color,
       sy.label AS school_year_name,
       COUNT(l.id)::int AS total_lessons,
       COUNT(CASE WHEN l.status = 'completed' THEN 1 END)::int AS completed_lessons,
       COALESCE(AVG(lc.grade), 0)::numeric(5,2) AS avg_grade,
       CASE WHEN COUNT(l.id) = COUNT(CASE WHEN l.status = 'completed' THEN 1 END) THEN true ELSE false END AS is_complete
     FROM curriculum_assignments ca
     JOIN curricula cu ON cu.id = ca.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
      LEFT JOIN school_years sy ON sy.id = ca.school_year_id
     JOIN lessons l ON l.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
      WHERE ca.child_id = $1
      AND ca.school_year_id IN (SELECT id FROM school_years WHERE CURRENT_DATE BETWEEN start_date AND end_date)
     GROUP BY cu.id, cu.name, s.id, s.name, s.color, sy.label
      HAVING COUNT(l.id) > 0
     ORDER BY s.name, cu.name`,
    [childId]
  );
  return res.rows;
}
