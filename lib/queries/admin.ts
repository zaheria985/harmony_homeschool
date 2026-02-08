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
      s.id, s.name, s.color, s.thumbnail_url,
      COUNT(DISTINCT cu.id)::int AS curriculum_count,
      COUNT(DISTINCT l.id)::int AS lesson_count
    FROM subjects s
    LEFT JOIN curricula cu ON cu.subject_id = s.id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    GROUP BY s.id, s.name, s.color, s.thumbnail_url
    ORDER BY s.name
  `);
  return res.rows;
}

export async function getSchoolYearsWithConfig() {
  const years = await pool.query(
    `SELECT sy.id, sy.label, sy.start_date::text, sy.end_date::text,
       (SELECT COUNT(*)::int FROM lessons l
        JOIN curricula cu ON cu.id = l.curriculum_id
        JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
        JOIN school_years sy2 ON sy2.id = ca.school_year_id
        WHERE sy2.id = sy.id) AS lesson_count
     FROM school_years sy ORDER BY sy.start_date DESC`
  );

  const result = [];
  for (const year of years.rows) {
    const days = await pool.query(
      "SELECT weekday FROM school_days WHERE school_year_id = $1 ORDER BY weekday",
      [year.id]
    );
    const overrides = await pool.query(
      "SELECT id, date::text, type, reason FROM date_overrides WHERE school_year_id = $1 ORDER BY date",
      [year.id]
    );
    result.push({
      ...year,
      weekdays: days.rows.map((d: { weekday: number }) => d.weekday),
      overrides: overrides.rows,
    });
  }
  return result;
}

export async function getAllCurricula() {
  const res = await pool.query(`
    SELECT
      cu.id, cu.name, cu.description, cu.subject_id, cu.cover_image,
      cu.course_type, cu.status, cu.start_date::text, cu.end_date::text, cu.notes,
      s.name AS subject_name, s.color AS subject_color,
      c.name AS child_name, c.id AS child_id,
      COUNT(DISTINCT l.id)::int AS lesson_count
    FROM curricula cu
    JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
    LEFT JOIN children c ON c.id = ca.child_id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    GROUP BY cu.id, cu.name, cu.description, cu.subject_id, cu.cover_image,
             cu.course_type, cu.status, cu.start_date, cu.end_date, cu.notes,
             s.name, s.color, c.name, c.id
    ORDER BY s.name, cu.name
  `);
  return res.rows;
}
