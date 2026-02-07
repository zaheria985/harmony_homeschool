import { NextRequest, NextResponse } from "next/server";
import { getLessonDetail } from "@/lib/queries/calendar";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const lesson = await getLessonDetail(params.id);
  if (!lesson) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ lesson });
}
