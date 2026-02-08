import pool from "@/lib/db";

export async function getAllCurricula() {
  const res = await pool.query(
    `SELECT
       cu.id, cu.name, cu.description, cu.order_index, cu.cover_image,
       cu.course_type, cu.status, cu.start_date::text, cu.end_date::text,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       ca.child_id,
       c.name AS child_name,
       COUNT(DISTINCT l.id)::int AS lesson_count,
       COUNT(DISTINCT CASE WHEN l.status = 'completed' THEN l.id END)::int AS completed_count
     FROM curricula cu
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     LEFT JOIN lessons l ON l.curriculum_id = cu.id
      GROUP BY cu.id, cu.name, cu.description, cu.order_index, cu.cover_image,
               cu.course_type, cu.status, cu.start_date, cu.end_date,
               s.id, s.name, s.color, ca.child_id, c.name
     ORDER BY c.name, s.name, cu.order_index, cu.name`
  );
  return res.rows;
}

export async function getCurriculumDetail(id: string) {
  const res = await pool.query(
    `SELECT
       cu.id, cu.name, cu.description, cu.order_index, cu.cover_image,
       cu.course_type, cu.status, cu.start_date::text, cu.end_date::text,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       ca.child_id,
       c.name AS child_name
     FROM curricula cu
     JOIN subjects s ON s.id = cu.subject_id
     LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     LEFT JOIN children c ON c.id = ca.child_id
     WHERE cu.id = $1
     LIMIT 1`,
    [id]
  );
  if (!res.rows[0]) return null;

  const childId = res.rows[0].child_id;
  const lessons = await pool.query(
    `SELECT
       l.id, l.title, l.status, l.planned_date, l.order_index, l.description,
       lc.grade, lc.completed_at
     FROM lessons l
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id ${childId ? "AND lc.child_id = $1" : ""}
     WHERE l.curriculum_id = $${childId ? 2 : 1}
     ORDER BY l.order_index, l.planned_date ASC NULLS LAST`,
    childId ? [childId, id] : [id]
  );

  return {
    ...res.rows[0],
    lessons: lessons.rows,
  };
}

export async function getCurriculumBoardData(id: string) {
  // Curriculum info
  const res = await pool.query(
    `SELECT
       cu.id, cu.name, cu.description, cu.order_index, cu.cover_image,
       cu.course_type, cu.status, cu.start_date::text, cu.end_date::text,
       s.id AS subject_id, s.name AS subject_name, s.color AS subject_color,
       ca.child_id,
       c.name AS child_name
     FROM curricula cu
     JOIN subjects s ON s.id = cu.subject_id
     LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     LEFT JOIN children c ON c.id = ca.child_id
     WHERE cu.id = $1
     LIMIT 1`,
    [id]
  );
  if (!res.rows[0]) return null;

  const curriculum = res.rows[0];

  // Lessons with resources and completions
  const lessons = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.status, l.planned_date,
       l.order_index, l.estimated_duration
     FROM lessons l
     WHERE l.curriculum_id = $1
     ORDER BY l.order_index, l.planned_date ASC NULLS LAST`,
    [id]
  );

  // All lesson resources for this curriculum's lessons
  const lessonResources = await pool.query(
    `SELECT
       lr.id, lr.lesson_id, lr.type, lr.url, lr.title, lr.thumbnail_url,
       lr.resource_id,
       r.type AS global_type, r.thumbnail_url AS global_thumbnail_url,
       r.description AS resource_description
     FROM lesson_resources lr
     LEFT JOIN resources r ON r.id = lr.resource_id
     WHERE lr.lesson_id IN (
       SELECT l.id FROM lessons l WHERE l.curriculum_id = $1
     )`,
    [id]
  );

  // Completions for all lessons in this curriculum
  const completions = await pool.query(
    `SELECT
       lc.lesson_id, lc.child_id, lc.completed_at, lc.grade, lc.notes,
       c.name AS child_name
     FROM lesson_completions lc
     JOIN children c ON c.id = lc.child_id
     WHERE lc.lesson_id IN (
       SELECT l.id FROM lessons l WHERE l.curriculum_id = $1
     )`,
    [id]
  );

  // All children assigned to this curriculum
  const assignedChildren = await pool.query(
    `SELECT c.id, c.name
     FROM curriculum_assignments ca
     JOIN children c ON c.id = ca.child_id
     WHERE ca.curriculum_id = $1
     ORDER BY c.name`,
    [id]
  );

  // Curriculum-level shared resources (directly attached to curriculum)
  const curriculumResources = await pool.query(
    `SELECT
       r.id, r.title, r.type, r.url, r.thumbnail_url, r.description,
       cr.notes AS attachment_notes, cr.created_at AS attached_at
     FROM curriculum_resources cr
     JOIN resources r ON r.id = cr.resource_id
     WHERE cr.curriculum_id = $1
     ORDER BY r.type, r.title`,
    [id]
  );

  // Group resources and completions by lesson
  const resourcesByLesson = new Map<string, typeof lessonResources.rows>();
  for (const lr of lessonResources.rows) {
    const list = resourcesByLesson.get(lr.lesson_id) || [];
    list.push(lr);
    resourcesByLesson.set(lr.lesson_id, list);
  }

  const completionsByLesson = new Map<string, typeof completions.rows>();
  for (const lc of completions.rows) {
    const list = completionsByLesson.get(lc.lesson_id) || [];
    list.push(lc);
    completionsByLesson.set(lc.lesson_id, list);
  }

  const lessonsWithDetails = lessons.rows.map((l: { id: string }) => ({
    ...l,
    resources: resourcesByLesson.get(l.id) || [],
    completions: completionsByLesson.get(l.id) || [],
  }));

  return {
    ...curriculum,
    lessons: lessonsWithDetails,
    children: assignedChildren.rows,
    curriculumResources: curriculumResources.rows,
  };
}
