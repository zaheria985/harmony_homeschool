import pool from "@/lib/db";

export async function getDashboardStats() {
  const res = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM children)::int AS total_students,
      (
        SELECT COUNT(DISTINCT l.id)::int
        FROM school_years sy
        JOIN curriculum_assignments ca ON ca.school_year_id = sy.id
        JOIN curricula cu ON cu.id = ca.curriculum_id
        JOIN lessons l ON l.curriculum_id = cu.id
        WHERE CURRENT_DATE BETWEEN sy.start_date AND sy.end_date
      ) AS active_year_total_lessons,
      (
        SELECT COUNT(DISTINCT l.id)::int
        FROM school_years sy
        JOIN curriculum_assignments ca ON ca.school_year_id = sy.id
        JOIN curricula cu ON cu.id = ca.curriculum_id
        JOIN lessons l ON l.curriculum_id = cu.id
        WHERE CURRENT_DATE BETWEEN sy.start_date AND sy.end_date
          AND l.status = 'completed'
      ) AS active_year_completed_lessons
  `);
  return res.rows[0];
}

export async function getUpcomingDueLessons(daysAhead = 3) {
  const res = await pool.query(
    `SELECT
       l.id,
       l.title,
       l.planned_date::text AS planned_date,
       l.status,
       c.name AS child_name,
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color,
       cu.name AS curriculum_name
     FROM lessons l
      JOIN curricula cu ON cu.id = l.curriculum_id
      JOIN subjects s ON s.id = cu.subject_id
      JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
      JOIN children c ON c.id = ca.child_id
      WHERE l.status != 'completed'
        AND l.planned_date >= CURRENT_DATE
        AND l.planned_date < CURRENT_DATE + (($1::text || ' days')::interval)
      ORDER BY l.planned_date ASC, c.name, s.name, l.title`,
    [daysAhead]
  );
  return res.rows;
}
