import pool from "@/lib/db";

export async function getAllChildren() {
  const res = await pool.query(`
    SELECT
      c.id, c.name, c.created_at,
      COUNT(DISTINCT s.id)::int AS subject_count,
      COUNT(DISTINCT l.id)::int AS total_lessons,
      COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS completed_lessons
    FROM children c
    LEFT JOIN curriculum_assignments ca ON ca.child_id = c.id
    LEFT JOIN curricula cu ON cu.id = ca.curriculum_id
    LEFT JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    GROUP BY c.id, c.name, c.created_at
    ORDER BY c.name
  `);
  return res.rows;
}

export async function getChildById(id: string) {
  const res = await pool.query(
    `SELECT id, name, created_at FROM children WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function getChildProgress(childId: string, yearId?: string) {
  const yearFilter = yearId
    ? "AND ca.school_year_id = $2"
    : "";
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
  const yearFilter = yearId ? "AND ca.school_year_id = $2" : "";
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
