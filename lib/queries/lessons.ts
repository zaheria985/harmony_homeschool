import pool from "@/lib/db";

export async function getLessonsByChild(
  childId: string,
  filters?: { status?: string; subjectId?: string }
) {
  const conditions = ["ca.child_id = $1"];
  const params: string[] = [childId];
  let idx = 2;

  if (filters?.status) {
    conditions.push(`l.status = $${idx++}`);
    params.push(filters.status);
  }
  if (filters?.subjectId) {
    conditions.push(`s.id = $${idx++}`);
    params.push(filters.subjectId);
  }

  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date, l.order_index,
       cu.id AS curriculum_id, cu.name AS curriculum_name,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       lc.grade, lc.notes AS completion_notes, lc.completed_at
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1
     WHERE ${conditions.join(" AND ")}
     ORDER BY l.planned_date ASC NULLS LAST, l.order_index`,
    params
  );
  return res.rows;
}

export async function getAllLessons(filters?: { status?: string; childId?: string }) {
  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;

  if (filters?.childId) {
    conditions.push(`ca.child_id = $${idx++}`);
    params.push(filters.childId);
  }
  if (filters?.status) {
    conditions.push(`l.status = $${idx++}`);
    params.push(filters.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date, l.order_index,
       cu.id AS curriculum_id, cu.name AS curriculum_name,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       ca.child_id,
       c.name AS child_name,
       lc.grade, lc.notes AS completion_notes, lc.completed_at
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = ca.child_id
     ${where}
     ORDER BY l.planned_date ASC NULLS LAST, l.order_index`,
    params
  );
  return res.rows;
}

export async function getLessonDetails(id: string, childId?: string) {
  const childJoin = childId ? "JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id" : "LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id";
  const childWhere = childId ? "AND ca.child_id = $2" : "";
  const params: string[] = [id];
  if (childId) params.push(childId);

  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date, l.order_index,
       cu.name AS curriculum_name, cu.id AS curriculum_id, cu.grade_type,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       ca.child_id,
       c.name AS child_name
      FROM lessons l
      JOIN curricula cu ON cu.id = l.curriculum_id
      JOIN subjects s ON s.id = cu.subject_id
      ${childJoin}
      LEFT JOIN children c ON c.id = ca.child_id
      WHERE l.id = $1
      ${childWhere}
      LIMIT 1`,
    params
  );
  if (!res.rows[0]) return null;

  // Lesson-specific resources with global resource info
  const resources = await pool.query(
    `SELECT
       lr.id, lr.type, lr.url, lr.title, lr.thumbnail_url, lr.page_number,
       lr.resource_id,
       r.description AS resource_description,
       r.type AS global_type,
       r.thumbnail_url AS global_thumbnail_url
     FROM lesson_resources lr
     LEFT JOIN resources r ON r.id = lr.resource_id
     WHERE lr.lesson_id = $1`,
    [id]
  );

  // Curriculum-level shared resources (attached to the curriculum itself)
  const curriculumResources = await pool.query(
    `SELECT
       r.id, r.title, r.type, r.url, r.thumbnail_url, r.description,
       cr.notes AS attachment_notes
     FROM curriculum_resources cr
     JOIN resources r ON r.id = cr.resource_id
     WHERE cr.curriculum_id = $1
     ORDER BY r.type, r.title`,
    [res.rows[0].curriculum_id]
  );

  const completion = await pool.query(
    `SELECT lc.id, lc.completed_at, lc.grade, lc.pass_fail, lc.notes, lc.child_id
     FROM lesson_completions lc WHERE lc.lesson_id = $1`,
    [id]
  );

  return {
    ...res.rows[0],
    resources: resources.rows,
    curriculumResources: curriculumResources.rows,
    completion: completion.rows[0] || null,
  };
}

export async function getAllLessonsWithResources(filters?: {
  status?: string;
  childId?: string;
}) {
  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;

  if (filters?.childId) {
    conditions.push(`ca.child_id = $${idx++}`);
    params.push(filters.childId);
  }
  if (filters?.status) {
    conditions.push(`l.status = $${idx++}`);
    params.push(filters.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date, l.order_index,
       cu.id AS curriculum_id, cu.name AS curriculum_name,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       ca.child_id,
       c.name AS child_name,
       lc.grade, lc.notes AS completion_notes, lc.completed_at,
       COUNT(lr.id)::int AS resource_count
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = ca.child_id
     LEFT JOIN lesson_resources lr ON lr.lesson_id = l.id
     ${where}
     GROUP BY l.id, l.title, l.description, l.status, l.planned_date, l.order_index,
              cu.id, cu.name, s.id, s.name, s.color, ca.child_id, c.name,
              lc.grade, lc.notes, lc.completed_at
     ORDER BY l.planned_date ASC NULLS LAST, l.order_index`,
    params
  );
  return res.rows;
}

export async function getUpcomingLessons(childId: string, limit = 5) {
  const res = await pool.query(
    `SELECT
       l.id, l.title, l.planned_date, l.status,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     WHERE ca.child_id = $1 AND l.status != 'completed' AND l.planned_date >= CURRENT_DATE
     ORDER BY l.planned_date ASC
     LIMIT $2`,
    [childId, limit]
  );
  return res.rows;
}
