import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  return {
    id: readString(user?.id) || "",
    // Fail closed: no role means unauthenticated, not parent. Consumers that
    // gate on `role === "kid"` still work; anything trusting a bare truthy
    // role should migrate to lib/server/authz.ts.
    role: readString(user?.role) || "",
    childId: readString(user?.child_id) || null,
    email: readString(user?.email) || null,
    name: readString(user?.name) || null,
    permissionLevel: readString(user?.permission_level) || "view_only",
  };
}

export async function isKidUser() {
  const user = await getCurrentUser();
  return user.role === "kid";
}
