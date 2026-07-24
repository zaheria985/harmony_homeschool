import pool from "@/lib/db";
import { todayKey } from "@/lib/utils/timezone";
import { resolveActiveSchoolYear } from "@/lib/queries/school-year";

export async function getDashboardStats(parentId?: string) {
  // Scope to a resolved year rather than "the year containing today" so the
  // stat keeps meaning during summers and between-year gaps.
  const year = await resolveActiveSchoolYear();

  const params: string[] = [];
  const parentFilter = parentId
    ? "JOIN parent_children pc ON pc.child_id = ca.child_id"
    : "";
  const parentWhere = parentId ? "AND pc.parent_id = $1" : "";
  const totalStudentsSql = parentId
    ? "(SELECT COUNT(DISTINCT pc.child_id)::int FROM parent_children pc WHERE pc.parent_id = $1)"
    : "(SELECT COUNT(*)::int FROM children)";
  if (parentId) params.push(parentId);

  if (!year) {
    const res = await pool.query(
      `SELECT ${totalStudentsSql} AS total_students`,
      params
    );
    return {
      ...res.rows[0],
      active_year_total_lessons: 0,
      active_year_completed_lessons: 0,
      school_year: null,
    };
  }

  params.push(year.id);
  const yearParam = `$${params.length}`;

  const res = await pool.query(`
    SELECT
      ${totalStudentsSql} AS total_students,
      (
        SELECT COUNT(DISTINCT l.id)::int
        FROM curriculum_assignments ca
        ${parentFilter}
        JOIN curricula cu ON cu.id = ca.curriculum_id
        JOIN lessons l ON l.curriculum_id = cu.id
        WHERE ca.school_year_id = ${yearParam}
          AND l.archived = false
          ${parentWhere}
      ) AS active_year_total_lessons,
      (
        SELECT COUNT(DISTINCT l.id)::int
        FROM curriculum_assignments ca
        ${parentFilter}
        JOIN curricula cu ON cu.id = ca.curriculum_id
        JOIN lessons l ON l.curriculum_id = cu.id
        WHERE ca.school_year_id = ${yearParam}
          AND l.status = 'completed'
          AND l.archived = false
          ${parentWhere}
      ) AS active_year_completed_lessons
  `, params);

  return { ...res.rows[0], school_year: year };
}

export async function getUpcomingDueLessons(daysAhead = 3, childId?: string, parentId?: string) {
  const params: (string | number)[] = [daysAhead, todayKey()];
  let childFilter = "";
  if (childId) {
    params.push(childId);
    childFilter = `AND ca.child_id = $${params.length}`;
  }
  let parentFilter = "";
  if (parentId) {
    params.push(parentId);
    parentFilter = `AND EXISTS (
         SELECT 1
         FROM parent_children pc
         WHERE pc.parent_id = $${params.length}
           AND pc.child_id = ca.child_id
       )`;
  }

  // DISTINCT: a curriculum assigned to the same child in two school years
  // joins twice and would list every lesson (and its checkbox) twice.
  const res = await pool.query(
     `SELECT DISTINCT
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
         AND l.archived = false
         AND l.planned_date >= $2::date
         AND l.planned_date < $2::date + (($1::text || ' days')::interval)
         ${childFilter}
         ${parentFilter}
        ORDER BY l.planned_date ASC, c.name, s.name, l.title`,
    params
  );
  return res.rows;
}

/**
 * The "how are we doing" strip on the dashboard: per-child progress for the
 * resolved school year, what got finished lately, and this week's reading.
 * One round trip so the dashboard does not grow a query per card.
 */
export async function getDashboardActivity(parentId?: string, sinceDays = 7) {
  const today = todayKey();
  const year = await resolveActiveSchoolYear();

  const params: (string | number)[] = [today, sinceDays];
  let ownership = "";
  if (parentId) {
    params.push(parentId);
    ownership = `AND EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = $${params.length} AND pc.child_id = c.id
    )`;
  }

  const yearParams: (string | number)[] = [];
  let progressYearFilter = "";
  if (year) {
    yearParams.push(year.id);
    progressYearFilter = `AND ca.school_year_id = $${yearParams.length}`;
  }
  let progressOwnership = "";
  if (parentId) {
    yearParams.push(parentId);
    progressOwnership = `AND EXISTS (
      SELECT 1 FROM parent_children pc
      WHERE pc.parent_id = $${yearParams.length} AND pc.child_id = c.id
    )`;
  }

  const [progressRes, recentRes, readingRes] = await Promise.all([
    pool.query(
      `SELECT
         c.id AS child_id,
         c.name AS child_name,
         COUNT(DISTINCT l.id)::int AS total_lessons,
         COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS completed_lessons
       FROM children c
       JOIN curriculum_assignments ca ON ca.child_id = c.id
       JOIN curricula cu ON cu.id = ca.curriculum_id
       JOIN lessons l ON l.curriculum_id = cu.id AND l.archived = false
       WHERE true ${progressYearFilter} ${progressOwnership}
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      yearParams,
    ),
    pool.query(
      `SELECT
         c.id AS child_id,
         c.name AS child_name,
         COUNT(*)::int AS completed_count
       FROM lesson_completions lc
       JOIN lessons l ON l.id = lc.lesson_id
       JOIN children c ON c.id = lc.child_id
       WHERE l.planned_date > $1::date - (($2::text || ' days')::interval)
         AND l.planned_date <= $1::date
         ${ownership}
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      params,
    ),
    pool.query(
      `SELECT
         c.id AS child_id,
         c.name AS child_name,
         COALESCE(SUM(rl.minutes_read), 0)::int AS minutes,
         COALESCE(SUM(rl.pages_read), 0)::int AS pages,
         COUNT(DISTINCT rl.resource_id)::int AS books
       FROM reading_log rl
       JOIN children c ON c.id = rl.child_id
       WHERE rl.date > $1::date - (($2::text || ' days')::interval)
         AND rl.date <= $1::date
         ${ownership}
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      params,
    ),
  ]);

  return {
    schoolYear: year,
    progress: progressRes.rows as Array<{
      child_id: string;
      child_name: string;
      total_lessons: number;
      completed_lessons: number;
    }>,
    recentCompletions: recentRes.rows as Array<{
      child_id: string;
      child_name: string;
      completed_count: number;
    }>,
    reading: readingRes.rows as Array<{
      child_id: string;
      child_name: string;
      minutes: number;
      pages: number;
      books: number;
    }>,
  };
}

export async function getTodayAssignmentsOverview() {
  const year = await resolveActiveSchoolYear();
  const today = todayKey();

  if (!year) {
    return { childYearStats: [], subjectYearStats: [], todayLessons: [], schoolYear: null };
  }

  const [childYearStatsRes, subjectYearStatsRes, todayLessonsRes] = await Promise.all([
    pool.query(
      `SELECT
         c.id AS child_id,
         c.name AS child_name,
         COUNT(DISTINCT l.id)::int AS year_total_lessons,
         COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS year_completed_lessons
       FROM children c
       JOIN curriculum_assignments ca ON ca.child_id = c.id
       JOIN curricula cu ON cu.id = ca.curriculum_id
       JOIN lessons l ON l.curriculum_id = cu.id
       WHERE ca.school_year_id = $1
         AND l.archived = false
       GROUP BY c.id, c.name
       ORDER BY c.name`,
      [year.id]
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
       JOIN curricula cu ON cu.id = ca.curriculum_id
       JOIN subjects s ON s.id = cu.subject_id
       JOIN lessons l ON l.curriculum_id = cu.id
       WHERE ca.school_year_id = $1
         AND l.archived = false
       GROUP BY c.id, s.id, s.name, s.color`,
      [year.id]
    ),
    // Today's work is listed whatever the school-year configuration says —
    // families school through the summer, and a lesson planned for today is
    // due today regardless of which year it belongs to.
    pool.query(
      `SELECT DISTINCT
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
       JOIN children c ON c.id = ca.child_id
       WHERE l.status != 'completed'
         AND l.archived = false
         AND l.planned_date = $1::date
       ORDER BY c.name, s.name, l.title`,
      [today]
    ),
  ]);

  return {
    childYearStats: childYearStatsRes.rows,
    subjectYearStats: subjectYearStatsRes.rows,
    todayLessons: todayLessonsRes.rows,
    schoolYear: year,
  };
}
