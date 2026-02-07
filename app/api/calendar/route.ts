import { NextRequest, NextResponse } from "next/server";
import { getLessonsForMonth } from "@/lib/queries/calendar";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const childId = searchParams.get("childId");
  const year = searchParams.get("year");
  const month = searchParams.get("month");

  if (!childId || !year || !month) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const lessons = await getLessonsForMonth(childId, Number(year), Number(month));
  return NextResponse.json({ lessons });
}
