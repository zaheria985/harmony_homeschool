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
        cu.grade_type,
        COUNT(l.id)::int AS total_lessons,
        COUNT(CASE WHEN l.status = 'completed' THEN 1 END)::int AS completed,
        COUNT(CASE WHEN l.status = 'in_progress' THEN 1 END)::int AS in_progress,
        COUNT(CASE WHEN l.status = 'planned' THEN 1 END)::int AS planned,
        COALESCE(AVG(lc.grade), 0)::numeric(5,2) AS avg_grade,
        COUNT(lc.grade)::int AS graded_count,
        COUNT(CASE WHEN lc.pass_fail = 'pass' THEN 1 END)::int AS pass_count,
        COUNT(CASE WHEN lc.pass_fail = 'fail' THEN 1 END)::int AS fail_count
      FROM curriculum_assignments ca
      JOIN curricula cu ON cu.id = ca.curriculum_id
      JOIN subjects s ON s.id = cu.subject_id
      JOIN lessons l ON l.curriculum_id = cu.id
      LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
      WHERE ca.child_id = $1 ${yearFilter}
      GROUP BY s.id, s.name, s.color, cu.grade_type
      ORDER BY s.name`,
    params
  );

  return {
    overall: overall.rows[0],
    subjects: subjects.rows,
  };
}

export async function getCompletedLessons(filters: {
  childId?: string;
  subjectId?: string;
  startDate?: string;
  endDate?: string;
  yearId?: string;
}) {
  const conditions: string[] = ["l.status = 'completed'"];
  const params: (string | undefined)[] = [];
  let paramIdx = 0;

  if (filters.childId) {
    paramIdx++;
    conditions.push(`ca.child_id = $${paramIdx}`);
    params.push(filters.childId);
  }
  if (filters.subjectId) {
    paramIdx++;
    conditions.push(`s.id = $${paramIdx}`);
    params.push(filters.subjectId);
  }
  if (filters.startDate) {
    paramIdx++;
    conditions.push(`lc.completed_at >= $${paramIdx}::date`);
    params.push(filters.startDate);
  }
  if (filters.endDate) {
    paramIdx++;
    conditions.push(`lc.completed_at < ($${paramIdx}::date + interval '1 day')`);
    params.push(filters.endDate);
  }
  if (filters.yearId) {
    paramIdx++;
    conditions.push(`ca.school_year_id = $${paramIdx}`);
    params.push(filters.yearId);
  }

  const res = await pool.query(
    `SELECT
       l.id, l.title, l.planned_date::text,
       cu.name AS curriculum_name,
       s.name AS subject_name, s.color AS subject_color,
       c.name AS child_name, c.id AS child_id,
       lc.completed_at::text, lc.grade::numeric(5,2), lc.notes
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = ca.child_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY lc.completed_at DESC, s.name, l.title`,
    params
  );
  return res.rows;
}

export async function getAllSchoolYearsForReports() {
  const res = await pool.query(
    `SELECT id, label, start_date::text AS start_date, end_date::text AS end_date
     FROM school_years
     ORDER BY start_date DESC`
  );
  return res.rows;
}
