import { NextRequest, NextResponse } from "next/server";
import { getOccurrenceNotes } from "@/lib/actions/external-events";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const date = searchParams.get("date");
  const eventIdsParam = searchParams.get("eventIds");

  if (!date || !eventIdsParam) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  const eventIds = eventIdsParam.split(",").filter(Boolean);
  if (eventIds.length === 0) {
    return NextResponse.json({ notes: [] });
  }

  const notes = await getOccurrenceNotes(eventIds, date);
  return NextResponse.json({ notes });
}
