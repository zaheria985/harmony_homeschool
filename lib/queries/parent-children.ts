import pool from "@/lib/db";

type ChildRow = {
  id: string;
  name: string;
  emoji: string | null;
  banner_url: string | null;
  created_at: string;
};

export async function getChildrenForParent(parentId: string): Promise<ChildRow[]> {
  const res = await pool.query(
    `SELECT c.id, c.name, c.emoji, c.banner_url, c.created_at
     FROM children c
     INNER JOIN parent_children pc ON pc.child_id = c.id
     WHERE pc.parent_id = $1
     ORDER BY c.name`,
    [parentId]
  );

  return res.rows as ChildRow[];
}

export async function parentOwnsChild(parentId: string, childId: string): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1
     FROM parent_children
     WHERE parent_id = $1 AND child_id = $2
     LIMIT 1`,
    [parentId, childId]
  );

  return (res.rowCount ?? 0) > 0;
}
