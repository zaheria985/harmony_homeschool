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

export async function getBookRecommendations(childId?: string) {
  // Strategy: find books (resources of type 'book') that are:
  // 1. Not on any booklist yet, OR only on wishlists (status check via absence from booklists)
  // 2. Share tags with active curricula for the given child
  // 3. Fall back to recently added books if no tag matches
  const params: string[] = [];
  let childFilter = "";
  let idx = 1;

  if (childId) {
    childFilter = `
      AND EXISTS (
        SELECT 1 FROM curriculum_assignments ca
        JOIN curricula cu ON cu.id = ca.curriculum_id
        JOIN subjects s ON s.id = cu.subject_id
        WHERE ca.child_id = $${idx}
      )
    `;
    params.push(childId);
    idx++;
  }

  // Get books with tag overlap scoring against active subject/curriculum tags
  const res = await pool.query(
    `WITH active_tags AS (
       SELECT DISTINCT t.name
       FROM tags t
       JOIN curriculum_tags ct ON ct.tag_id = t.id
       JOIN curricula cu ON cu.id = ct.curriculum_id
       ${childId
         ? `JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id WHERE ca.child_id = $1`
         : `WHERE 1=1`
       }
       UNION
       SELECT DISTINCT s.name
       FROM subjects s
       JOIN curricula cu ON cu.subject_id = s.id
       ${childId
         ? `JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id WHERE ca.child_id = $1`
         : `WHERE 1=1`
       }
     ),
     book_scores AS (
       SELECT
         r.id, r.title, r.author, r.thumbnail_url, r.created_at,
         COUNT(DISTINCT at2.name) AS tag_matches,
         COALESCE(bt.tags, ARRAY[]::text[]) AS tags
       FROM resources r
       LEFT JOIN resource_tags rt ON rt.resource_id = r.id
       LEFT JOIN tags t ON t.id = rt.tag_id
       LEFT JOIN active_tags at2 ON LOWER(at2.name) = LOWER(t.name)
       LEFT JOIN (
         SELECT rt2.resource_id, ARRAY_AGG(t2.name ORDER BY t2.name) AS tags
         FROM resource_tags rt2
         JOIN tags t2 ON t2.id = rt2.tag_id
         GROUP BY rt2.resource_id
       ) bt ON bt.resource_id = r.id
       WHERE r.type = 'book'
         AND NOT EXISTS (
           SELECT 1 FROM booklist_resources br WHERE br.resource_id = r.id
         )
       GROUP BY r.id, r.title, r.author, r.thumbnail_url, r.created_at, bt.tags
     )
     SELECT id, title, author, thumbnail_url, tag_matches, tags
     FROM book_scores
     ORDER BY tag_matches DESC, created_at DESC
     LIMIT 10`,
    params
  );

  return res.rows as {
    id: string;
    title: string;
    author: string | null;
    thumbnail_url: string | null;
    tag_matches: number;
    tags: string[];
  }[];
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
