import pool from "@/lib/db";

export async function getAllResources(filters?: {
  type?: string;
  search?: string;
  tag?: string;
}) {
  const conditions: string[] = [];
  const params: string[] = [];
  let idx = 1;

  if (filters?.type) {
    conditions.push(`r.type = $${idx++}`);
    params.push(filters.type);
  }
  if (filters?.search) {
    conditions.push(`(r.title ILIKE $${idx} OR r.author ILIKE $${idx} OR r.description ILIKE $${idx})`);
    params.push(`%${filters.search}%`);
    idx++;
  }
  if (filters?.tag) {
    conditions.push(
      `EXISTS (
        SELECT 1
        FROM resource_tags rt
        JOIN tags t ON t.id = rt.tag_id
        WHERE rt.resource_id = r.id AND t.name = $${idx}
      )`
    );
    params.push(filters.tag.toLowerCase());
    idx++;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const res = await pool.query(
    `WITH library_resources AS (
       SELECT
         r.id,
         r.title,
         r.type,
         r.author,
         r.url,
         r.thumbnail_url,
         r.description,
         r.created_at,
         COALESCE(u.usage_count, 0)::int AS usage_count,
         COALESCE(t.tags, ARRAY[]::text[]) AS tags,
         true AS is_global
       FROM resources r
       LEFT JOIN (
         SELECT resource_id, COUNT(*)::int AS usage_count
         FROM lesson_resources
         WHERE resource_id IS NOT NULL
         GROUP BY resource_id
       ) u ON u.resource_id = r.id
       LEFT JOIN (
         SELECT rt.resource_id, ARRAY_AGG(t.name ORDER BY t.name) AS tags
         FROM resource_tags rt
         JOIN tags t ON t.id = rt.tag_id
         GROUP BY rt.resource_id
       ) t ON t.resource_id = r.id
     ),
     inline_lesson_resources AS (
       SELECT
         lr.id,
         COALESCE(NULLIF(lr.title, ''), lr.url) AS title,
         CASE
           WHEN lr.type = 'youtube' THEN 'video'
           WHEN lr.type = 'url' THEN 'link'
           ELSE lr.type
         END AS type,
         NULL::text AS author,
         lr.url,
         lr.thumbnail_url,
         NULL::text AS description,
         now() AS created_at,
         COUNT(DISTINCT lr.lesson_id)::int AS usage_count,
         ARRAY[]::text[] AS tags,
         false AS is_global
       FROM lesson_resources lr
       WHERE lr.resource_id IS NULL
       GROUP BY lr.id, lr.title, lr.type, lr.url, lr.thumbnail_url
     )
     SELECT *
     FROM (
       SELECT * FROM library_resources
       UNION ALL
       SELECT * FROM inline_lesson_resources
     ) r
     ${where}
     ORDER BY r.created_at DESC`,
    params
  );
  return res.rows;
}

export async function getResourceById(id: string) {
  const res = await pool.query(
    `SELECT
       r.id, r.title, r.type, r.author, r.url, r.thumbnail_url, r.description, r.created_at,
       COALESCE(t.tags, ARRAY[]::text[]) AS tags
     FROM resources r
     LEFT JOIN (
       SELECT rt.resource_id, ARRAY_AGG(t.name ORDER BY t.name) AS tags
       FROM resource_tags rt
       JOIN tags t ON t.id = rt.tag_id
       GROUP BY rt.resource_id
     ) t ON t.resource_id = r.id
     WHERE r.id = $1`,
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

export async function getAllResourceTags() {
  const res = await pool.query(
    `SELECT t.id, t.name, COUNT(rt.resource_id)::int AS resource_count
     FROM tags t
     LEFT JOIN resource_tags rt ON rt.tag_id = t.id
     GROUP BY t.id, t.name
     ORDER BY t.name`
  );
  return res.rows;
}

export async function getAllTagNames(): Promise<string[]> {
  const res = await pool.query(`SELECT name FROM tags ORDER BY name`);
  return res.rows.map((r: { name: string }) => r.name);
}

export async function getAllBookResources() {
  const res = await pool.query(
    `SELECT
       r.id,
       r.title,
       r.author,
       r.thumbnail_url,
       COALESCE(t.tags, ARRAY[]::text[]) AS tags
     FROM resources r
     LEFT JOIN (
       SELECT rt.resource_id, ARRAY_AGG(t.name ORDER BY t.name) AS tags
       FROM resource_tags rt
       JOIN tags t ON t.id = rt.tag_id
       GROUP BY rt.resource_id
     ) t ON t.resource_id = r.id
     WHERE type = 'book'
     ORDER BY r.title`
  );
  return res.rows;
}
