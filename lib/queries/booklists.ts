import pool from "@/lib/db";

export async function getAllBooklists() {
  const lists = await pool.query(
    `SELECT id, name, owner_child_id, description, created_at::text
     FROM booklists
     ORDER BY name`
  );

  const resources = await pool.query(
    `SELECT
       br.booklist_id,
       r.id,
       r.title,
       r.author,
       r.thumbnail_url,
       COALESCE(t.tags, ARRAY[]::text[]) AS tags,
       br.position
     FROM booklist_resources br
     JOIN resources r ON r.id = br.resource_id
     LEFT JOIN (
       SELECT rt.resource_id, ARRAY_AGG(t.name ORDER BY t.name) AS tags
       FROM resource_tags rt
       JOIN tags t ON t.id = rt.tag_id
       GROUP BY rt.resource_id
     ) t ON t.resource_id = r.id
     WHERE r.type = 'book'
     ORDER BY br.booklist_id, br.position, r.title`
  );

  const resourcesByList = new Map<string, typeof resources.rows>();
  for (const row of resources.rows) {
    const list = resourcesByList.get(row.booklist_id) || [];
    list.push(row);
    resourcesByList.set(row.booklist_id, list);
  }

  return lists.rows.map((list) => ({
    ...list,
    books: resourcesByList.get(list.id) || [],
  }));
}

export async function ensureChildWishlist(childId: string, childName: string) {
  await pool.query(
    `INSERT INTO booklists (name, owner_child_id, description)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM booklists WHERE owner_child_id = $2
     )`,
    [`${childName} wants to read...`, childId, `Personal reading wishlist for ${childName}`]
  );
}

export async function getLinkedBooklists(curriculumId: string) {
  const res = await pool.query(
    `SELECT b.id, b.name, b.description,
       (SELECT COUNT(*)::int FROM booklist_resources br WHERE br.booklist_id = b.id) AS book_count
     FROM curriculum_booklists cb
     JOIN booklists b ON b.id = cb.booklist_id
     WHERE cb.curriculum_id = $1
     ORDER BY b.name`,
    [curriculumId]
  );
  return res.rows as { id: string; name: string; description: string | null; book_count: number }[];
}

export async function getAllBooklistSummaries() {
  const res = await pool.query(
    `SELECT b.id, b.name,
       (SELECT COUNT(*)::int FROM booklist_resources br WHERE br.booklist_id = b.id) AS book_count
     FROM booklists b
     ORDER BY b.name`
  );
  return res.rows as { id: string; name: string; book_count: number }[];
}

export async function getBooklistsForResource(resourceId: string) {
  const res = await pool.query(
    `SELECT booklist_id
     FROM booklist_resources
     WHERE resource_id = $1`,
    [resourceId]
  );

  return res.rows.map((row) => row.booklist_id as string);
}
