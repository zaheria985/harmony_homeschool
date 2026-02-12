import { NextRequest, NextResponse } from "next/server";
import { getLessonDetail } from "@/lib/queries/calendar";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { SessionUser } from "@/lib/types";
import { parentOwnsChild } from "@/lib/queries/parent-children"; /** * GET /api/lessons/:id * * Auth: * - Requires authenticated session. * - Kid users are scoped to their own child_id. * * Responses: * - 200: { lesson } * - 404: { error:"Not found" } */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const user = session?.user as SessionUser | undefined;
  const lesson = await getLessonDetail(
    params.id,
    user?.role === "kid" ? user.child_id || undefined : undefined,
  );
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (user?.role === "parent" && user.id) {
    const childId =
      typeof lesson.child_id === "string" ? lesson.child_id : null;
    if (!childId || !(await parentOwnsChild(user.id, childId))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }
  return NextResponse.json({ lesson });
}
