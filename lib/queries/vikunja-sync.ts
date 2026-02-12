import pool from "@/lib/db";

export async function getUpcomingLessonsForSync(days = 14) {
  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.planned_date, l.status,
       s.name AS subject_name,
       cu.name AS curriculum_name,
       ca.child_id,
       c.name AS child_name
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     WHERE l.status != 'completed'
       AND l.planned_date IS NOT NULL
       AND l.planned_date >= CURRENT_DATE
       AND l.planned_date < CURRENT_DATE + $1 * INTERVAL '1 day'
     ORDER BY l.planned_date, c.name, s.name`,
    [days]
  );
  return res.rows;
}

export async function getUpcomingResourcesForSync(days = 14) {
  const res = await pool.query(
    `SELECT DISTINCT
       r.id, r.title, r.type, r.url, r.description AS resource_description,
       l.id AS lesson_id, l.title AS lesson_title, l.planned_date,
       ca.child_id,
       c.name AS child_name,
       s.name AS subject_name
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     JOIN lesson_resources lr ON lr.lesson_id = l.id
     JOIN resources r ON r.id = lr.resource_id
     WHERE l.status != 'completed'
       AND l.planned_date IS NOT NULL
       AND l.planned_date >= CURRENT_DATE
       AND l.planned_date < CURRENT_DATE + $1 * INTERVAL '1 day'

     UNION

     SELECT DISTINCT
       r.id, r.title, r.type, r.url, r.description AS resource_description,
       l.id AS lesson_id, l.title AS lesson_title, l.planned_date,
       ca.child_id,
       c.name AS child_name,
       s.name AS subject_name
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     JOIN curriculum_resources cr ON cr.curriculum_id = cu.id
     JOIN resources r ON r.id = cr.resource_id
     WHERE l.status != 'completed'
       AND l.planned_date IS NOT NULL
       AND l.planned_date >= CURRENT_DATE
       AND l.planned_date < CURRENT_DATE + $1 * INTERVAL '1 day'

     ORDER BY planned_date, child_name`,
    [days]
  );
  return res.rows;
}

export async function getExistingMappings() {
  const res = await pool.query(
    `SELECT id, vikunja_task_id, lesson_id, resource_id, sync_type, child_id
     FROM vikunja_task_map`
  );
  return res.rows;
}

export async function getMappingByVikunjaTaskId(vikunjaTaskId: number) {
  const res = await pool.query(
    `SELECT id, vikunja_task_id, lesson_id, resource_id, sync_type, child_id
     FROM vikunja_task_map
     WHERE vikunja_task_id = $1`,
    [vikunjaTaskId]
  );
  return res.rows[0] || null;
}

export async function insertMapping(
  vikunjaTaskId: number,
  lessonId: string | null,
  resourceId: string | null,
  syncType: "lesson" | "resource",
  childId: string
) {
  await pool.query(
    `INSERT INTO vikunja_task_map (vikunja_task_id, lesson_id, resource_id, sync_type, child_id)
     VALUES ($1, $2, $3, $4, $5)`,
    [vikunjaTaskId, lessonId, resourceId, syncType, childId]
  );
}

export async function deleteMapping(vikunjaTaskId: number) {
  await pool.query(
    `DELETE FROM vikunja_task_map WHERE vikunja_task_id = $1`,
    [vikunjaTaskId]
  );
}

export async function getCompletedMappedLessons() {
  const res = await pool.query(
    `SELECT vtm.vikunja_task_id, vtm.lesson_id
     FROM vikunja_task_map vtm
     JOIN lessons l ON l.id = vtm.lesson_id
     WHERE vtm.sync_type = 'lesson'
       AND l.status = 'completed'`
  );
  return res.rows;
}

export async function getPastMappedLessons() {
  const res = await pool.query(
    `SELECT vtm.vikunja_task_id, vtm.lesson_id
     FROM vikunja_task_map vtm
     JOIN lessons l ON l.id = vtm.lesson_id
     WHERE vtm.sync_type = 'lesson'
       AND l.planned_date < CURRENT_DATE
       AND l.status = 'completed'`
  );
  return res.rows;
}
