import { NextRequest, NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { subjectsRouteDependencies } from "@/lib/api-route-deps";

export async function GET(request: NextRequest) {
  const {
    getServerSession: fetchSession,
    getAllSubjects: fetchAllSubjects,
    getSubjectsForChild: fetchSubjectsForChild,
    resolveParentChildScopeForRequest: resolveScope,
  } = subjectsRouteDependencies;

  const session = await fetchSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = session.user as SessionUser;
  const childId = request.nextUrl.searchParams.get("childId");

  const resolvedScope = await resolveScope(user, childId);
  if (resolvedScope.error === "missing_child_scope") {
    return NextResponse.json({ error: "Missing child scope" }, { status: 403 });
  }
  if (resolvedScope.error === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (resolvedScope.childId) {
    const subjects = await fetchSubjectsForChild(resolvedScope.childId);
    return NextResponse.json({ subjects });
  }

  const subjects = await fetchAllSubjects();
  return NextResponse.json({ subjects });
}
