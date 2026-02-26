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
  type SchoolYearRow = {
    id: string;
    label: string;
    start_date: string;
    end_date: string;
    lesson_count: number;
  };

  const years = await pool.query(
    `SELECT sy.id, sy.label, sy.start_date::text, sy.end_date::text,
       (SELECT COUNT(*)::int FROM lessons l
        JOIN curricula cu ON cu.id = l.curriculum_id
        JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
        JOIN school_years sy2 ON sy2.id = ca.school_year_id
        WHERE sy2.id = sy.id) AS lesson_count
     FROM school_years sy ORDER BY sy.start_date DESC`
  );

  const yearIds = (years.rows as SchoolYearRow[]).map((year) => year.id);
  if (yearIds.length === 0) return [];

  const weekdaysRes = await pool.query(
    `SELECT school_year_id, weekday
     FROM school_days
     WHERE school_year_id = ANY($1::uuid[])
     ORDER BY school_year_id, weekday`,
    [yearIds]
  );

  const overridesRes = await pool.query(
    `SELECT school_year_id, id, date::text, type, reason
     FROM date_overrides
     WHERE school_year_id = ANY($1::uuid[])
     ORDER BY school_year_id, date`,
    [yearIds]
  );

  const weekdaysByYear = new Map<string, number[]>();
  for (const row of weekdaysRes.rows as Array<{ school_year_id: string; weekday: number }>) {
    const current = weekdaysByYear.get(row.school_year_id) || [];
    current.push(row.weekday);
    weekdaysByYear.set(row.school_year_id, current);
  }

  const overridesByYear = new Map<
    string,
    Array<{ id: string; date: string; type: "exclude" | "include"; reason: string | null }>
  >();
  for (const row of overridesRes.rows as Array<{
    school_year_id: string;
    id: string;
    date: string;
    type: "exclude" | "include";
    reason: string | null;
  }>) {
    const current = overridesByYear.get(row.school_year_id) || [];
    current.push({
      id: row.id,
      date: row.date,
      type: row.type,
      reason: row.reason,
    });
    overridesByYear.set(row.school_year_id, current);
  }

  return (years.rows as SchoolYearRow[]).map((year) => ({
    ...year,
    weekdays: weekdaysByYear.get(year.id) || [],
    overrides: overridesByYear.get(year.id) || [],
  }));
}

export async function getAllCurricula() {
  const res = await pool.query(`
    SELECT
      cu.id, cu.name, cu.description, cu.subject_id, cu.cover_image,
      cu.course_type, cu.grade_type, cu.status, cu.start_date::text, cu.end_date::text, cu.notes,
      s.name AS subject_name, s.color AS subject_color,
      c.name AS child_name, c.id AS child_id,
      COALESCE(array_agg(DISTINCT cad.weekday ORDER BY cad.weekday)
        FILTER (WHERE cad.weekday IS NOT NULL), '{}') AS configured_weekdays,
      COALESCE(array_agg(DISTINCT sd.weekday ORDER BY sd.weekday)
        FILTER (WHERE sd.weekday IS NOT NULL), '{}') AS school_weekdays,
      COUNT(DISTINCT l.id)::int AS lesson_count
    FROM curricula cu
    JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
    LEFT JOIN children c ON c.id = ca.child_id
    LEFT JOIN curriculum_assignment_days cad ON cad.assignment_id = ca.id
    LEFT JOIN school_days sd ON sd.school_year_id = ca.school_year_id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    GROUP BY cu.id, cu.name, cu.description, cu.subject_id, cu.cover_image,
             cu.course_type, cu.grade_type, cu.status, cu.start_date, cu.end_date, cu.notes,
             s.name, s.color, c.name, c.id
    ORDER BY s.name, cu.name
  `);
  return res.rows;
}

type ScheduleExceptionRow = {
  assignment_id: string;
  curriculum_id: string;
  curriculum_name: string;
  child_id: string;
  child_name: string;
  school_year_id: string;
  school_year_label: string;
  configured_weekdays: number[];
  school_weekdays: number[];
};

export async function getCurriculumScheduleExceptions() {
  const res = await pool.query(
    `SELECT
       ca.id AS assignment_id,
       cu.id AS curriculum_id,
       cu.name AS curriculum_name,
       c.id AS child_id,
       c.name AS child_name,
       sy.id AS school_year_id,
       sy.label AS school_year_label,
       COALESCE(array_agg(DISTINCT cad.weekday ORDER BY cad.weekday)
         FILTER (WHERE cad.weekday IS NOT NULL), '{}') AS configured_weekdays,
       COALESCE(array_agg(DISTINCT sd.weekday ORDER BY sd.weekday)
         FILTER (WHERE sd.weekday IS NOT NULL), '{}') AS school_weekdays
     FROM curriculum_assignments ca
     JOIN curricula cu ON cu.id = ca.curriculum_id
     JOIN children c ON c.id = ca.child_id
     JOIN school_years sy ON sy.id = ca.school_year_id
     LEFT JOIN curriculum_assignment_days cad ON cad.assignment_id = ca.id
     LEFT JOIN school_days sd ON sd.school_year_id = ca.school_year_id
     GROUP BY ca.id, cu.id, cu.name, c.id, c.name, sy.id, sy.label
     ORDER BY sy.start_date DESC, cu.name, c.name`
  );

  const rows = res.rows as ScheduleExceptionRow[];
  return rows.filter((row) => {
    if (row.configured_weekdays.length === 0) return false;
    return row.configured_weekdays.join(",") !== row.school_weekdays.join(",");
  });
}

export async function getAdminAnalytics() {
  // Completion trend: lessons completed per week for last 12 weeks
  const completionTrend = await pool.query(`
    SELECT
      DATE_TRUNC('week', lc.completed_at)::date AS week_start,
      COUNT(*)::int AS count
    FROM lesson_completions lc
    WHERE lc.completed_at >= NOW() - INTERVAL '12 weeks'
    GROUP BY DATE_TRUNC('week', lc.completed_at)
    ORDER BY week_start
  `);

  // Subject balance: lesson count per subject
  const subjectBalance = await pool.query(`
    SELECT
      s.name AS subject_name,
      s.color AS subject_color,
      COUNT(DISTINCT l.id)::int AS lesson_count
    FROM subjects s
    LEFT JOIN curricula cu ON cu.subject_id = s.id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    GROUP BY s.id, s.name, s.color
    HAVING COUNT(DISTINCT l.id) > 0
    ORDER BY lesson_count DESC
  `);

  // Time to complete: avg days between scheduled_date and completion date
  const timeToComplete = await pool.query(`
    SELECT
      ROUND(AVG(EXTRACT(EPOCH FROM (lc.completed_at - l.planned_date::timestamp)) / 86400), 1) AS avg_days
    FROM lesson_completions lc
    JOIN lessons l ON l.id = lc.lesson_id
    WHERE l.planned_date IS NOT NULL
      AND lc.completed_at IS NOT NULL
  `);

  // Active children: children with completions in the last 30 days
  const activeChildren = await pool.query(`
    SELECT DISTINCT c.id, c.name
    FROM children c
    JOIN lesson_completions lc ON lc.child_id = c.id
    WHERE lc.completed_at >= NOW() - INTERVAL '30 days'
    ORDER BY c.name
  `);

  return {
    completionTrend: completionTrend.rows as Array<{
      week_start: string;
      count: number;
    }>,
    subjectBalance: subjectBalance.rows as Array<{
      subject_name: string;
      subject_color: string | null;
      lesson_count: number;
    }>,
    avgDaysToComplete: timeToComplete.rows[0]?.avg_days
      ? Number(timeToComplete.rows[0].avg_days)
      : null,
    activeChildren: activeChildren.rows as Array<{ id: string; name: string }>,
  };
}

export async function getArchiveStats() {
  const res = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM lessons WHERE status = 'completed' AND archived = false) AS archivable_count,
      (SELECT COUNT(*)::int FROM lessons WHERE archived = true) AS archived_count
  `);

  const byYear = await pool.query(`
    SELECT
      sy.id AS year_id,
      sy.label AS year_label,
      COUNT(DISTINCT CASE WHEN l.status = 'completed' AND l.archived = false THEN l.id END)::int AS archivable_count,
      COUNT(DISTINCT CASE WHEN l.archived = true THEN l.id END)::int AS archived_count
    FROM school_years sy
    JOIN curriculum_assignments ca ON ca.school_year_id = sy.id
    JOIN lessons l ON l.curriculum_id = ca.curriculum_id
    GROUP BY sy.id, sy.label
    ORDER BY sy.label DESC
  `);

  return {
    ...res.rows[0],
    byYear: byYear.rows as Array<{
      year_id: string;
      year_label: string;
      archivable_count: number;
      archived_count: number;
    }>,
  };
}
