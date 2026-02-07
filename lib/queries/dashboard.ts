import pool from "@/lib/db";

export async function getDashboardStats() {
  const res = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM children)::int AS total_students,
      (SELECT COUNT(*) FROM lessons)::int AS total_lessons,
      (SELECT COUNT(*) FROM lessons WHERE status = 'completed')::int AS completed_lessons,
      (SELECT COUNT(*) FROM lessons WHERE status = 'in_progress')::int AS in_progress_lessons,
      (SELECT COALESCE(AVG(lc.grade), 0) FROM lesson_completions lc WHERE lc.grade IS NOT NULL)::numeric(5,2) AS avg_grade
  `);
  return res.rows[0];
}

export async function getRecentActivity(limit = 10) {
  const res = await pool.query(
    `SELECT
       lc.id,
       lc.completed_at,
       lc.grade,
       lc.notes,
       l.id AS lesson_id,
       l.title AS lesson_title,
       c.name AS child_name,
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color
     FROM lesson_completions lc
     JOIN lessons l ON l.id = lc.lesson_id
     JOIN children c ON c.id = lc.child_id
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     ORDER BY lc.completed_at DESC
     LIMIT $1`,
    [limit]
  );
  return res.rows;
}
