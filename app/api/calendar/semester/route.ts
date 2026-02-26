import { NextRequest, NextResponse } from "next/server";
import { getSemesterOverview } from "@/lib/queries/calendar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { resolveParentChildScopeForRequest } from "@/lib/auth-scope";

/**
 * GET /api/calendar/semester
 *
 * Query params:
 * - startMonth: YYYY-MM (required)
 * - months: number (default 6)
 * - childId?: string (UUID)
 *
 * Returns: { data: { date: string, total: number, completed: number }[] }
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { searchParams } = request.nextUrl;
  const startMonth = searchParams.get("startMonth");
  const months = Math.min(Math.max(Number(searchParams.get("months")) || 6, 1), 12);
  const requestedChildId = searchParams.get("childId");

  if (!startMonth || !/^\d{4}-\d{2}$/.test(startMonth)) {
    return NextResponse.json(
      { error: "Missing or invalid startMonth param (expected YYYY-MM)" },
      { status: 400 }
    );
  }

  const scope = await resolveParentChildScopeForRequest(user, requestedChildId);
  if (scope.error === "missing_child_scope") {
    return NextResponse.json({ error: "Missing child scope" }, { status: 403 });
  }
  if (scope.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const childId = scope.childId || undefined;
  const parentId = user.role === "parent" && user.id ? user.id : undefined;

  const data = await getSemesterOverview(startMonth, months, childId, parentId);
  return NextResponse.json({ data });
}
