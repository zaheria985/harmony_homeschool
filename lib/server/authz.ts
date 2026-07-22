import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

/**
 * Authorization guards for server actions.
 *
 * Next.js server actions are POST endpoints that bypass `middleware.ts` — the
 * matcher there only gates page navigations. Every exported action in
 * `lib/actions/` must therefore check its own caller.
 *
 * Usage (parent-only, the default for mutations):
 *
 *   export async function deleteThing(id: string) {
 *     const user = await requireParent();
 *     if (!user) return { error: "Unauthorized" };
 *     ...
 *   }
 */

export type AuthedUser = {
  id: string;
  role: "parent" | "kid";
  childId: string | null;
  permissionLevel: "full" | "mark_complete" | "view_only";
};

function readString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Returns the signed-in user, or null when there is no valid session.
 *
 * Fails closed: a token missing `id` or `role` is treated as unauthenticated
 * rather than defaulting to a parent identity.
 */
export async function requireUser(): Promise<AuthedUser | null> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) return null;

  const id = readString(user.id);
  const role = readString(user.role);
  if (!id) return null;
  if (role !== "parent" && role !== "kid") return null;

  const permission = readString(user.permission_level);
  const permissionLevel =
    permission === "full" || permission === "mark_complete" || permission === "view_only"
      ? permission
      : "view_only";

  return {
    id,
    role,
    childId: readString(user.child_id),
    // A parent always has full rights regardless of the stored column.
    permissionLevel: role === "parent" ? "full" : permissionLevel,
  };
}

/** Returns the signed-in user only when they are a parent, else null. */
export async function requireParent(): Promise<AuthedUser | null> {
  const user = await requireUser();
  if (!user || user.role !== "parent") return null;
  return user;
}

/**
 * Returns the child id the caller is allowed to act on.
 *
 * Parents act on whatever child they request. Kids are pinned to their own
 * `child_id` — a caller-supplied id is never trusted.
 */
export function scopedChildId(
  user: AuthedUser,
  requestedChildId: string | null
): string | null {
  if (user.role === "kid") return user.childId;
  return requestedChildId;
}
