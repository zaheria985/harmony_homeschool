import { parentOwnsChild } from "@/lib/queries/parent-children";

export type SessionScopeUser = {
  id?: string;
  role?: string;
  child_id?: string | null;
};

export function resolveChildScopeForRequest(
  user: SessionScopeUser,
  requestedChildId: string | null
): { childId: string | null; error?: "missing_child_scope" | "forbidden" } {
  if (user.role !== "kid") {
    return { childId: requestedChildId };
  }

  if (!user.child_id) {
    return { childId: null, error: "missing_child_scope" };
  }

  if (requestedChildId && requestedChildId !== user.child_id) {
    return { childId: null, error: "forbidden" };
  }

  return { childId: user.child_id };
}

export async function resolveParentChildScopeForRequest(
  user: SessionScopeUser,
  requestedChildId: string | null
): Promise<{ childId: string | null; error?: "missing_child_scope" | "forbidden" }> {
  const kidScope = resolveChildScopeForRequest(user, requestedChildId);
  if (user.role === "kid") {
    return kidScope;
  }

  if (user.role !== "parent" || !requestedChildId) {
    return { childId: requestedChildId };
  }

  if (!user.id) {
    return { childId: null, error: "forbidden" };
  }

  const ownsChild = await parentOwnsChild(user.id, requestedChildId);
  if (!ownsChild) {
    return { childId: null, error: "forbidden" };
  }

  return { childId: requestedChildId };
}
