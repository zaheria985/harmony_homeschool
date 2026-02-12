import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

function formatIcalDate(dateStr: string): string {
  // planned_date is a DATE column (YYYY-MM-DD) — use VALUE=DATE format
  return dateStr.replace(/-/g, "");
}

function formatIcalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const kidFilter = searchParams.get("kid");
  const token = searchParams.get("token");

  // Optional token-based auth
  const expectedToken = process.env.ICAL_TOKEN;
  if (expectedToken && token !== expectedToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const params: string[] = [];
  const conditions = [
    "l.status != 'completed'",
    "l.planned_date IS NOT NULL",
    "l.planned_date >= CURRENT_DATE",
  ];

  if (kidFilter) {
    params.push(kidFilter);
    conditions.push(`c.name = $${params.length}`);
  }

  const res = await pool.query(
    `SELECT
       l.id, l.title, l.description, l.planned_date,
       s.name AS subject_name,
       cu.name AS curriculum_name,
       c.name AS child_name
     FROM lessons l
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
     JOIN children c ON c.id = ca.child_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY l.planned_date, s.name, l.order_index`,
    params
  );

  const now = formatIcalDateTime(new Date());
  const events = res.rows
    .map((row: Record<string, string | null>) => {
      const dateStr = String(row.planned_date);
      const dtStart = formatIcalDate(dateStr);
      // All-day event: DTEND is next day
      const endDate = new Date(dateStr);
      endDate.setDate(endDate.getDate() + 1);
      const dtEnd = formatIcalDate(
        `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`
      );

      const summary = escapeIcal(
        `[${row.subject_name}] ${row.title} - ${row.child_name}`
      );
      const description = row.description
        ? escapeIcal(
            `${row.curriculum_name}\n\n${row.description}`
          )
        : escapeIcal(String(row.curriculum_name));

      return [
        "BEGIN:VEVENT",
        `UID:${row.id}@harmony-homeschool`,
        `DTSTAMP:${now}`,
        `DTSTART;VALUE=DATE:${dtStart}`,
        `DTEND;VALUE=DATE:${dtEnd}`,
        `SUMMARY:${summary}`,
        `DESCRIPTION:${description}`,
        // Reminder 1 day before
        "BEGIN:VALARM",
        "TRIGGER:-P1D",
        "ACTION:DISPLAY",
        "DESCRIPTION:Lesson tomorrow",
        "END:VALARM",
        // Reminder 30 minutes before
        "BEGIN:VALARM",
        "TRIGGER:-PT30M",
        "ACTION:DISPLAY",
        "DESCRIPTION:Lesson starting soon",
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    })
    .join("\r\n");

  const calendar = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Harmony Homeschool//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Harmony Homeschool",
    events,
    "END:VCALENDAR",
  ].join("\r\n");

  return new NextResponse(calendar, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="harmony.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
