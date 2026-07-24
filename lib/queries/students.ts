import pool from "@/lib/db";
import { resolveActiveSchoolYear } from "@/lib/queries/school-year";

export async function getActiveSchoolYear() {
  return resolveActiveSchoolYear();
}

/**
 * SQL fragment scoping assignments to a year. Callers that were handed an
 * explicit year use it; the rest fall back to the resolved year so the page
 * still shows numbers during a summer or between-year gap.
 */
async function yearScope(params: string[], yearId?: string) {
  if (yearId) {
    params.push(yearId);
    return `AND ca.school_year_id = $${params.length}`;
  }
  const resolved = await resolveActiveSchoolYear();
  if (!resolved) return "";
  params.push(resolved.id);
  return `AND ca.school_year_id = $${params.length}`;
}

export async function getAllChildren(parentId?: string) {
  const params: string[] = [];
  const ownershipJoin = parentId
    ? "JOIN parent_children pc ON pc.child_id = c.id"
    : "";
  const ownershipWhere = parentId ? "WHERE pc.parent_id = $1" : "";
  if (parentId) params.push(parentId);

  const res = await pool.query(`
    SELECT
      c.id, c.name, c.emoji, c.banner_url, c.created_at,
      COUNT(DISTINCT s.id)::int AS subject_count,
      COUNT(DISTINCT l.id)::int AS total_lessons,
      COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS completed_lessons
    FROM children c
    ${ownershipJoin}
    LEFT JOIN curriculum_assignments ca ON ca.child_id = c.id
    LEFT JOIN curricula cu ON cu.id = ca.curriculum_id
    LEFT JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    ${ownershipWhere}
    GROUP BY c.id, c.name, c.emoji, c.banner_url, c.created_at
    ORDER BY c.name
  `, params);
  return res.rows;
}

export async function getChildById(id: string) {
  const res = await pool.query(
    `SELECT id, name, emoji, banner_url, created_at FROM children WHERE id = $1`,
    [id]
  );
  return res.rows[0] || null;
}

export async function getChildProgress(childId: string, yearId?: string) {
  const params: string[] = [childId];
  const yearFilter = await yearScope(params, yearId);

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
  const params: string[] = [childId];
  const yearFilter = await yearScope(params, yearId);

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

export async function getYearOverYearProgress(childId: string) {
  const res = await pool.query(`
    SELECT sy.id AS year_id, sy.label AS year_name,
           COUNT(DISTINCT ca.curriculum_id)::int AS total_curricula,
           COUNT(DISTINCT l.id)::int AS total_lessons,
           COUNT(DISTINCT lc.id)::int AS completed_lessons,
           ROUND(AVG(lc.grade)::numeric, 1) AS avg_grade
    FROM school_years sy
    JOIN curriculum_assignments ca ON ca.school_year_id = sy.id AND ca.child_id = $1
    JOIN curricula cu ON cu.id = ca.curriculum_id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
    GROUP BY sy.id, sy.label
    ORDER BY sy.label
  `, [childId]);
  return res.rows;
}

export async function getYearSummaryReport(childId: string, yearId: string) {
  const res = await pool.query(`
    SELECT
      s.name AS subject_name,
      cu.name AS curriculum_name,
      COUNT(DISTINCT l.id)::int AS total_lessons,
      COUNT(DISTINCT lc.id)::int AS completed_lessons,
      ROUND(AVG(lc.grade)::numeric, 1) AS avg_grade
    FROM curriculum_assignments ca
    JOIN curricula cu ON cu.id = ca.curriculum_id
    JOIN subjects s ON s.id = cu.subject_id
    LEFT JOIN lessons l ON l.curriculum_id = cu.id
    LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
    WHERE ca.child_id = $1 AND ca.school_year_id = $2
    GROUP BY s.name, cu.name
    ORDER BY s.name, cu.name
  `, [childId, yearId]);
  return res.rows;
}

export async function getCompletedCurricula(childId: string, yearId?: string) {
  const params: string[] = [childId];
  const yearFilter = await yearScope(params, yearId);

  const res = await pool.query(
    `SELECT
       cu.id AS curriculum_id,
       cu.name AS curriculum_name,
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color,
       sy.label AS school_year_name,
       COUNT(l.id)::int AS total_lessons,
       COUNT(CASE WHEN l.status = 'completed' THEN 1 END)::int AS completed_lessons,
       COALESCE(AVG(lc.grade), 0)::numeric(5,2) AS avg_grade,
       CASE WHEN COUNT(l.id) = COUNT(CASE WHEN l.status = 'completed' THEN 1 END) THEN true ELSE false END AS is_complete
     FROM curriculum_assignments ca
     JOIN curricula cu ON cu.id = ca.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     LEFT JOIN school_years sy ON sy.id = ca.school_year_id
     JOIN lessons l ON l.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
     WHERE ca.child_id = $1 ${yearFilter}
     GROUP BY cu.id, cu.name, s.id, s.name, s.color, sy.label
     HAVING COUNT(l.id) > 0
     ORDER BY s.name, cu.name`,
    params
  );
  return res.rows;
}
