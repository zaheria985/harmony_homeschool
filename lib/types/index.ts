export type SessionUser = {
  id?: string;
  role?: string;
  child_id?: string | null;
  email?: string | null;
  name?: string | null;
};

export type ActionResult<T = void> =
  | { success: true; data?: T }
  | { error: string };
