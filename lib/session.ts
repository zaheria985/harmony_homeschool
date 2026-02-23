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
    role: readString(user?.role) || "parent",
    childId: readString(user?.child_id) || null,
    email: readString(user?.email) || null,
    name: readString(user?.name) || null,
    permissionLevel: readString(user?.permission_level) || "full",
  };
}

export async function isKidUser() {
  const user = await getCurrentUser();
  return user.role === "kid";
}
