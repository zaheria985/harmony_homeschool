import pool from "@/lib/db";

export async function getAdminStats() {
  const res = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM children) AS child_count,
      (SELECT COUNT(*)::int FROM subjects) AS subject_count,
      (SELECT COUNT(*)::int FROM curricula) AS curriculum_count,
      (SELECT COUNT(*)::int FROM lessons) AS lesson_count
  `);
  return res.rows[0];
}

export async function getAllSubjects() {
  const res = await pool.query(`
    SELECT
      s.id, s.name, s.color,
      COUNT(DISTINCT cu.id)::int AS curriculum_count,
      COUNT(DISTINCT l.id)::int AS lesson_count
    FROM subjects s
    LEFT JOIN curricula cu ON cu.subject_id = s.id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    GROUP BY s.id, s.name, s.color
    ORDER BY s.name
  `);
  return res.rows;
}

export async function getAllCurricula() {
  const res = await pool.query(`
    SELECT
      cu.id, cu.name, cu.description, cu.subject_id,
      s.name AS subject_name, s.color AS subject_color,
      c.name AS child_name, c.id AS child_id,
      COUNT(DISTINCT l.id)::int AS lesson_count
    FROM curricula cu
    JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
    LEFT JOIN children c ON c.id = ca.child_id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    GROUP BY cu.id, cu.name, cu.description, cu.subject_id, s.name, s.color, c.name, c.id
    ORDER BY s.name, cu.name
  `);
  return res.rows;
}
