export type PermissionLevel = "full" | "mark_complete" | "view_only";

export type SessionUser = {
  id?: string;
  role?: string;
  child_id?: string | null;
  email?: string | null;
  name?: string | null;
  permission_level?: PermissionLevel | string;
};

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { error: string };
