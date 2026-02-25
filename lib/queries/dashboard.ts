import pool from "@/lib/db";

export async function getDashboardStats(parentId?: string) {
  const params: string[] = [];
  const parentFilter = parentId
    ? "JOIN parent_children pc ON pc.child_id = ca.child_id"
    : "";
  const parentWhere = parentId ? "AND pc.parent_id = $1" : "";
  const totalStudentsSql = parentId
    ? "(SELECT COUNT(DISTINCT pc.child_id)::int FROM parent_children pc WHERE pc.parent_id = $1)"
    : "(SELECT COUNT(*)::int FROM children)";
  if (parentId) params.push(parentId);

  const res = await pool.query(`
    SELECT
      ${totalStudentsSql} AS total_students,
      (
        SELECT COUNT(DISTINCT l.id)::int
        FROM school_years sy
        JOIN curriculum_assignments ca ON ca.school_year_id = sy.id
        ${parentFilter}
        JOIN curricula cu ON cu.id = ca.curriculum_id
        JOIN lessons l ON l.curriculum_id = cu.id
        WHERE CURRENT_DATE BETWEEN sy.start_date AND sy.end_date
          ${parentWhere}
      ) AS active_year_total_lessons,
      (
        SELECT COUNT(DISTINCT l.id)::int
        FROM school_years sy
        JOIN curriculum_assignments ca ON ca.school_year_id = sy.id
        ${parentFilter}
        JOIN curricula cu ON cu.id = ca.curriculum_id
        JOIN lessons l ON l.curriculum_id = cu.id
        WHERE CURRENT_DATE BETWEEN sy.start_date AND sy.end_date
          AND l.status = 'completed'
          ${parentWhere}
      ) AS active_year_completed_lessons
  `, params);
  return res.rows[0];
}

export async function getUpcomingDueLessons(daysAhead = 3, childId?: string, parentId?: string) {
  const params: (string | number)[] = [daysAhead];
  const childFilter = childId ? "AND ca.child_id = $2" : "";
  if (childId) params.push(childId);
  const parentFilter = parentId
    ? `AND EXISTS (
         SELECT 1
         FROM parent_children pc
         WHERE pc.parent_id = $${params.length + 1}
           AND pc.child_id = ca.child_id
       )`
    : "";
  if (parentId) params.push(parentId);

  const res = await pool.query(
     `SELECT
        l.id,
        l.title,
        l.planned_date::text AS planned_date,
        l.status,
        c.id AS child_id,
        c.name AS child_name,
        s.id AS subject_id,
        s.name AS subject_name,
        s.color AS subject_color,
        cu.name AS curriculum_name,
        cu.id AS curriculum_id
     FROM lessons l
      JOIN curricula cu ON cu.id = l.curriculum_id
      JOIN subjects s ON s.id = cu.subject_id
      JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
      JOIN children c ON c.id = ca.child_id
       WHERE l.status != 'completed'
         AND l.planned_date >= CURRENT_DATE
         AND l.planned_date < CURRENT_DATE + (($1::text || ' days')::interval)
         ${childFilter}
         ${parentFilter}
        ORDER BY l.planned_date ASC, c.name, s.name, l.title`,
    params
  );
  return res.rows;
}

export async function getTodayAssignmentsOverview() {
  const [childYearStatsRes, subjectYearStatsRes, todayLessonsRes] = await Promise.all([
    pool.query(
      `SELECT
         c.id AS child_id,
         c.name AS child_name,
         COUNT(DISTINCT l.id)::int AS year_total_lessons,
         COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS year_completed_lessons
       FROM children c
       JOIN curriculum_assignments ca ON ca.child_id = c.id
       JOIN school_years sy ON sy.id = ca.school_year_id
       JOIN curricula cu ON cu.id = ca.curriculum_id
       JOIN lessons l ON l.curriculum_id = cu.id
       WHERE CURRENT_DATE BETWEEN sy.start_date AND sy.end_date
       GROUP BY c.id, c.name
       ORDER BY c.name`
    ),
    pool.query(
      `SELECT
         c.id AS child_id,
         s.id AS subject_id,
         s.name AS subject_name,
         s.color AS subject_color,
         COUNT(DISTINCT l.id)::int AS year_total_lessons,
         COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS year_completed_lessons
       FROM children c
       JOIN curriculum_assignments ca ON ca.child_id = c.id
       JOIN school_years sy ON sy.id = ca.school_year_id
       JOIN curricula cu ON cu.id = ca.curriculum_id
       JOIN subjects s ON s.id = cu.subject_id
       JOIN lessons l ON l.curriculum_id = cu.id
       WHERE CURRENT_DATE BETWEEN sy.start_date AND sy.end_date
       GROUP BY c.id, s.id, s.name, s.color`
    ),
    pool.query(
      `SELECT
         c.id AS child_id,
         c.name AS child_name,
         s.id AS subject_id,
         s.name AS subject_name,
         s.color AS subject_color,
         cu.name AS curriculum_name,
         l.id AS lesson_id,
         l.title AS lesson_title
       FROM lessons l
       JOIN curricula cu ON cu.id = l.curriculum_id
       JOIN subjects s ON s.id = cu.subject_id
       JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
       JOIN school_years sy ON sy.id = ca.school_year_id
       JOIN children c ON c.id = ca.child_id
       WHERE l.status != 'completed'
         AND l.planned_date = CURRENT_DATE
         AND CURRENT_DATE BETWEEN sy.start_date AND sy.end_date
       ORDER BY c.name, s.name, l.title`
    ),
  ]);

  return {
    childYearStats: childYearStatsRes.rows,
    subjectYearStats: subjectYearStatsRes.rows,
    todayLessons: todayLessonsRes.rows,
  };
}
