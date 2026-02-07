import { NextRequest, NextResponse } from "next/server";
import { getCurriculaForSubject } from "@/lib/queries/calendar";

export async function GET(request: NextRequest) {
  const subjectId = request.nextUrl.searchParams.get("subjectId");
  if (!subjectId) {
    return NextResponse.json({ error: "Missing subjectId" }, { status: 400 });
  }

  const curricula = await getCurriculaForSubject(subjectId);
  return NextResponse.json({ curricula });
}
