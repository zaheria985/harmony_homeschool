import pool from "@/lib/db";

export async function getUpcomingPrepMaterials(daysAhead = 7, childId?: string) {
  const params: (number | string)[] = [daysAhead];
  const childFilter = childId ? "AND ca.child_id = $2" : "";
  if (childId) params.push(childId);

  const lessonResources = await pool.query(
    `SELECT
       l.id AS lesson_id,
       l.title AS lesson_title,
       l.planned_date::text AS planned_date,
       c.id AS child_id,
       c.name AS child_name,
       s.name AS subject_name,
       cu.name AS curriculum_name,
       COALESCE(r.id, lr.id) AS material_id,
       COALESCE(r.title, lr.title, lr.url) AS material_title,
       COALESCE(r.type, lr.type) AS material_type,
       COALESCE(r.thumbnail_url, lr.thumbnail_url) AS material_thumbnail
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     JOIN lesson_resources lr ON lr.lesson_id = l.id
     LEFT JOIN resources r ON r.id = lr.resource_id
     WHERE l.status != 'completed'
       AND l.archived = false
       AND l.planned_date >= CURRENT_DATE
       AND l.planned_date < CURRENT_DATE + (($1::text || ' days')::interval)
       AND COALESCE(r.type, lr.type) IN ('book', 'supply')
       ${childFilter}
     ORDER BY l.planned_date, c.name, s.name, material_title`,
    params
  );

  const curriculumResources = await pool.query(
    `SELECT
       l.id AS lesson_id,
       l.title AS lesson_title,
       l.planned_date::text AS planned_date,
       c.id AS child_id,
       c.name AS child_name,
       s.name AS subject_name,
       cu.name AS curriculum_name,
       r.id AS material_id,
       r.title AS material_title,
       r.type AS material_type,
       r.thumbnail_url AS material_thumbnail
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     JOIN curriculum_resources cr ON cr.curriculum_id = cu.id
     JOIN resources r ON r.id = cr.resource_id
     WHERE l.status != 'completed'
       AND l.archived = false
       AND l.planned_date >= CURRENT_DATE
       AND l.planned_date < CURRENT_DATE + (($1::text || ' days')::interval)
       AND r.type IN ('book', 'supply')
       ${childFilter}
     ORDER BY l.planned_date, c.name, s.name, r.title`,
    params
  );

  return [...lessonResources.rows, ...curriculumResources.rows];
}
