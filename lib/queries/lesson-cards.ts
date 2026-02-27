import pool from "@/lib/db";

export async function getLessonCards(lessonId: string) {
  const res = await pool.query(
    `SELECT
       lc.id, lc.lesson_id, lc.card_type, lc.title, lc.content,
       lc.url, lc.thumbnail_url, lc.og_title, lc.og_description, lc.og_image,
       lc.resource_id, lc.order_index,
       lc.created_at,
       r.title AS resource_title, r.type AS resource_type,
       r.url AS resource_url, r.thumbnail_url AS resource_thumbnail_url,
       r.description AS resource_description
     FROM lesson_cards lc
     LEFT JOIN resources r ON r.id = lc.resource_id
     WHERE lc.lesson_id = $1
     ORDER BY lc.order_index, lc.created_at`,
    [lessonId]
  );
  return res.rows;
}

export async function getLessonCardsByIds(lessonIds: string[]) {
  if (lessonIds.length === 0) return [];
  const res = await pool.query(
    `SELECT
       lc.id, lc.lesson_id, lc.card_type, lc.title, lc.content,
       lc.url, lc.thumbnail_url, lc.og_title, lc.og_description, lc.og_image,
       lc.resource_id, lc.order_index,
       lc.created_at,
       r.title AS resource_title, r.type AS resource_type,
       r.url AS resource_url, r.thumbnail_url AS resource_thumbnail_url,
       r.description AS resource_description
     FROM lesson_cards lc
     LEFT JOIN resources r ON r.id = lc.resource_id
     WHERE lc.lesson_id = ANY($1::uuid[])
     ORDER BY lc.order_index, lc.created_at`,
    [lessonIds]
  );
  return res.rows;
}
