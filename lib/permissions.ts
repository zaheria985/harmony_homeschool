import pool from "@/lib/db";

export type PermissionLevel = "full" | "mark_complete" | "view_only";

export function canEdit(permissionLevel: PermissionLevel | string): boolean {
  return permissionLevel === "full";
}

export function canMarkComplete(
  permissionLevel: PermissionLevel | string,
): boolean {
  return permissionLevel === "full" || permissionLevel === "mark_complete";
}

export function canView(_permissionLevel: PermissionLevel | string): boolean {
  return true; // all levels can view
}

/** Check if a parent user owns a specific child via the parent_children table. */
export async function verifyParentOwnsChild(
  parentUserId: string,
  childId: string,
): Promise<boolean> {
  const res = await pool.query(
    "SELECT 1 FROM parent_children WHERE parent_id = $1 AND child_id = $2",
    [parentUserId, childId],
  );
  return res.rows.length > 0;
}
