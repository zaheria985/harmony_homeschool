import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { resolveParentChildScopeForRequest } from "@/lib/auth-scope";
import { getAttendanceSummary } from "@/lib/queries/attendance";

export const dynamic = "force-dynamic";

/** Escape a value for CSV: quote it and double any embedded quotes. */
function csvCell(value: string | number | null): string {
  const text = value === null ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | { id?: string; role?: string; child_id?: string | null }
    | undefined;
  if (!user || user.role === "kid") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const childId = searchParams.get("childId");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!childId || !start || !end) {
    return NextResponse.json(
      { error: "childId, start, and end are required" },
      { status: 400 },
    );
  }

  const scope = await resolveParentChildScopeForRequest(user, childId);
  if (scope.error) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const summary = await getAttendanceSummary(childId, start, end);
  if (!summary) {
    return NextResponse.json({ error: "Child not found" }, { status: 404 });
  }

  if (searchParams.get("format") !== "csv") {
    return NextResponse.json(summary);
  }

  const rows: string[] = [
    ["Date", "Status", "Source", "Lessons completed", "Minutes", "Note"]
      .map(csvCell)
      .join(","),
  ];
  for (const day of summary.days) {
    rows.push(
      [
        day.date,
        day.status,
        day.source,
        day.lessonsCompleted,
        day.minutes,
        day.note,
      ]
        .map(csvCell)
        .join(","),
    );
  }
  rows.push("");
  rows.push([csvCell("Days attended"), csvCell(summary.daysAttended)].join(","));
  rows.push([csvCell("Total minutes"), csvCell(summary.totalMinutes)].join(","));
  rows.push([csvCell("Total hours"), csvCell(summary.totalHours)].join(","));

  const filename = `attendance-${summary.childName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${start}-to-${end}.csv`;

  return new NextResponse(rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
