import { NextRequest, NextResponse } from "next/server";
import { getSubjectsForChild } from "@/lib/queries/calendar";
import { getAllSubjects } from "@/lib/queries/subjects";

export async function GET(request: NextRequest) {
  const childId = request.nextUrl.searchParams.get("childId");

  // If childId provided, return subjects that have curricula assigned to that child
  if (childId) {
    const subjects = await getSubjectsForChild(childId);
    return NextResponse.json({ subjects });
  }

  // Otherwise return all global subjects
  const subjects = await getAllSubjects();
  return NextResponse.json({ subjects });
}
