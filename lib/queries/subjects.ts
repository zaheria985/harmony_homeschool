import pool from "@/lib/db";

export async function getAllSubjects() {
  const res = await pool.query(
    `SELECT
       s.id, s.name, s.color, s.thumbnail_url,
       COALESCE(ARRAY_AGG(DISTINCT ca.child_id) FILTER (WHERE ca.child_id IS NOT NULL), ARRAY[]::uuid[]) AS child_ids,
       COUNT(DISTINCT l.id)::int AS lesson_count,
       COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS completed_count,
       COUNT(DISTINCT cu.id)::int AS curriculum_count
     FROM subjects s
     LEFT JOIN curricula cu ON cu.subject_id = s.id
     LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     LEFT JOIN lessons l ON l.curriculum_id = cu.id
     GROUP BY s.id, s.name, s.color, s.thumbnail_url
     ORDER BY s.name`
  );
  return res.rows;
}

export async function getSubjectDetail(id: string) {
  const res = await pool.query(
    `SELECT s.id, s.name, s.color, s.thumbnail_url
     FROM subjects s
     WHERE s.id = $1`,
    [id]
  );
  if (!res.rows[0]) return null;

  const curricula = await pool.query(
    `SELECT
       cu.id, cu.name, cu.description, cu.order_index, cu.cover_image,
       COUNT(l.id)::int AS total_lessons,
       COUNT(CASE WHEN l.status = 'completed' THEN 1 END)::int AS completed_lessons
     FROM curricula cu
     LEFT JOIN lessons l ON l.curriculum_id = cu.id
     WHERE cu.subject_id = $1
     GROUP BY cu.id, cu.name, cu.description, cu.order_index, cu.cover_image
     ORDER BY cu.order_index, cu.name`,
    [id]
  );

  const lessons = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date, l.order_index,
       cu.name AS curriculum_name, cu.id AS curriculum_id,
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
     WHERE cu.subject_id = $1
     GROUP BY l.id, l.title, l.description, l.status, l.planned_date, l.order_index,
              cu.name, cu.id, s.id, s.name, s.color, ca.child_id, c.name,
              lc.grade, lc.notes, lc.completed_at
     ORDER BY l.planned_date ASC NULLS LAST, l.order_index`,
    [id]
  );

  return {
    ...res.rows[0],
    curricula: curricula.rows,
    lessons: lessons.rows,
  };
}
