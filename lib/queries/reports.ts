import pool from "@/lib/db";

export async function getProgressReport(childId: string, yearId?: string) {
  const yearFilter = yearId ? "AND ca.school_year_id = $2" : "";
  const params: string[] = [childId];
  if (yearId) params.push(yearId);

  // Overall stats
  const overall = await pool.query(
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

  // Per-subject breakdown
  const subjects = await pool.query(
    `SELECT
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color,
       COUNT(l.id)::int AS total_lessons,
       COUNT(CASE WHEN l.status = 'completed' THEN 1 END)::int AS completed,
       COUNT(CASE WHEN l.status = 'in_progress' THEN 1 END)::int AS in_progress,
       COUNT(CASE WHEN l.status = 'planned' THEN 1 END)::int AS planned,
       COALESCE(AVG(lc.grade), 0)::numeric(5,2) AS avg_grade,
       COUNT(lc.grade)::int AS graded_count
     FROM curriculum_assignments ca
     JOIN curricula cu ON cu.id = ca.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN lessons l ON l.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1 AND lc.grade IS NOT NULL
     WHERE ca.child_id = $1 ${yearFilter}
     GROUP BY s.id, s.name, s.color
     ORDER BY s.name`,
    params
  );

  return {
    overall: overall.rows[0],
    subjects: subjects.rows,
  };
}
