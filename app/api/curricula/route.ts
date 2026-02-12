import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { curriculaRouteDependencies } from "@/lib/api-route-deps"; /** * GET /api/curricula * * Query params: * - subjectId: string (UUID, required) * * Auth: * - Requires authenticated session. * - Kid users are limited to curricula assigned to their child scope. * * Responses: * - 200: { curricula } * - 400: { error:"Missing subjectId" } * - 401: { error:"Unauthorized" } * - 403: { error:"Missing child scope" } */
export async function GET(request: NextRequest) {
  const {
    getServerSession: fetchSession,
    getCurriculaForSubject: fetchCurriculaForSubject,
    getCurriculaForSubjectForChild: fetchCurriculaForSubjectForChild,
    resolveParentChildScopeForRequest: resolveScope,
  } = curriculaRouteDependencies;
  const session = await fetchSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session.user as SessionUser;
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  const childId = request.nextUrl.searchParams.get("childId");
  if (!subjectId) {
    return NextResponse.json({ error: "Missing subjectId" }, { status: 400 });
  }
  const resolvedScope = await resolveScope(user, childId);
  if (resolvedScope.error === "missing_child_scope") {
    return NextResponse.json({ error: "Missing child scope" }, { status: 403 });
  }
  if (resolvedScope.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (resolvedScope.childId) {
    const curricula = await fetchCurriculaForSubjectForChild(
      subjectId,
      resolvedScope.childId,
    );
    return NextResponse.json({ curricula });
  }
  const curricula = await fetchCurriculaForSubject(subjectId);
  return NextResponse.json({ curricula });
}
