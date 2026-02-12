import { NextRequest, NextResponse } from "next/server";
import { getLessonsForMonth } from "@/lib/queries/calendar";
import { getExternalEventOccurrencesForRange } from "@/lib/queries/external-events";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { resolveParentChildScopeForRequest } from "@/lib/auth-scope"; /** * GET /api/calendar * * Query params: * - year: number (required) * - month: number (required) * - childId?: string (UUID) * - viewMode?: all | completed | planned * * Auth: * - Requires authenticated session. * - Kid users are forced to their own child scope. * * Responses: * - 200: { lessons } * - 400: { error:"Missing params" } */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const { searchParams } = request.nextUrl;
  const requestedChildId = searchParams.get("childId");
  const viewModeParam = searchParams.get("viewMode") || "planned";
  const viewMode =
    viewModeParam === "all" ||
    viewModeParam === "completed" ||
    viewModeParam === "planned"
      ? viewModeParam
      : "planned";
  const year = searchParams.get("year");
  const month = searchParams.get("month");
  if (!year || !month) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }
  const yearNum = Number(year);
  const monthNum = Number(month);
  const scope = await resolveParentChildScopeForRequest(user, requestedChildId);
  if (scope.error === "missing_child_scope") {
    return NextResponse.json({ error: "Missing child scope" }, { status: 403 });
  }
  if (scope.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const childId = scope.childId || "";
  const parentId = user.role === "parent" && user.id ? user.id : undefined;
  const lessons = await getLessonsForMonth(
    childId,
    yearNum,
    monthNum,
    viewMode,
    parentId,
  );
  const rangeStart = `${yearNum}-${String(monthNum).padStart(2, "0")}-01`;
  const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
  const rangeEnd = `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;
  const externalEvents = await getExternalEventOccurrencesForRange(
    rangeStart,
    rangeEnd,
    childId || undefined,
    parentId,
  );
  return NextResponse.json({ lessons, externalEvents });
}
