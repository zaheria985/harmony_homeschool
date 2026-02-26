import pool from "@/lib/db";

export async function getReadingLog(childId?: string) {
  const res = await pool.query(
    `SELECT rl.id, rl.resource_id, rl.child_id, rl.date::text, rl.pages_read,
            rl.minutes_read, rl.notes, rl.created_at,
            r.title AS resource_title, r.author AS resource_author,
            r.thumbnail_url AS resource_thumbnail,
            c.name AS child_name, c.emoji AS child_emoji
     FROM reading_log rl
     JOIN resources r ON r.id = rl.resource_id
     JOIN children c ON c.id = rl.child_id
     ${childId ? "WHERE rl.child_id = $1" : ""}
     ORDER BY rl.date DESC, rl.created_at DESC`,
    childId ? [childId] : []
  );
  return res.rows;
}

export async function getBookResources() {
  const res = await pool.query(
    `SELECT id, title, author, thumbnail_url
     FROM resources
     WHERE type = 'book'
     ORDER BY title`
  );
  return res.rows;
}

export async function getReadingStats(childId?: string) {
  const res = await pool.query(
    `SELECT
       COUNT(DISTINCT rl.resource_id)::int AS books_read,
       COALESCE(SUM(rl.pages_read), 0)::int AS total_pages,
       COALESCE(SUM(rl.minutes_read), 0)::int AS total_minutes,
       COUNT(*)::int AS total_entries
     FROM reading_log rl
     ${childId ? "WHERE rl.child_id = $1" : ""}`,
    childId ? [childId] : []
  );
  return res.rows[0];
}
