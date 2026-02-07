import pool from "@/lib/db";

export async function getAllResources(filters?: {
  type?: string;
  search?: string;
}) {
  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;

  if (filters?.type) {
    conditions.push(`r.type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters?.search) {
    conditions.push(`(r.title ILIKE $${idx} OR r.description ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const res = await pool.query(
    `SELECT
       r.id, r.title, r.type, r.url, r.thumbnail_url, r.description, r.created_at,
       COUNT(lr.id)::int AS usage_count
     FROM resources r
     LEFT JOIN lesson_resources lr ON lr.resource_id = r.id
     ${where}
     GROUP BY r.id
     ORDER BY r.created_at DESC`,
    params
  );
  return res.rows;
}

export async function getResourceById(id: string) {
  const res = await pool.query(
    `SELECT id, title, type, url, thumbnail_url, description, created_at
     FROM resources WHERE id = $1`,
    [id]
  );
  if (!res.rows[0]) return null;

  const lessons = await pool.query(
    `SELECT
       l.id, l.title, l.status, l.planned_date,
       s.name AS subject_name, s.color AS subject_color,
       c.name AS child_name, c.id AS child_id
     FROM lesson_resources lr
     JOIN lessons l ON l.id = lr.lesson_id
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     LEFT JOIN children c ON c.id = ca.child_id
     WHERE lr.resource_id = $1
     ORDER BY l.planned_date ASC NULLS LAST`,
    [id]
  );

  return {
    ...res.rows[0],
    lessons: lessons.rows,
  };
}

export async function getResourcesByType(type: string) {
  return getAllResources({ type });
}
