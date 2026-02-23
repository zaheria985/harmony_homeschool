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
