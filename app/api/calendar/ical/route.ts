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
  return dateStr.replace(/-/g, "");
}

function formatIcalDateTime(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Format a TIME column value (HH:MM:SS or HH:MM) into iCal time HHMMSS */
function formatTimeToIcal(time: string): string {
  const parts = time.split(":");
  const hh = parts[0].padStart(2, "0");
  const mm = (parts[1] || "00").padStart(2, "0");
  const ss = (parts[2] || "00").padStart(2, "0");
  return `${hh}${mm}${ss}`;
}

const DAY_MAP: Record<number, string> = {
  0: "SU",
  1: "MO",
  2: "TU",
  3: "WE",
  4: "TH",
  5: "FR",
  6: "SA",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const childId = searchParams.get("child");

  // Verify token matches ICAL_TOKEN env var
  const expectedToken = process.env.ICAL_TOKEN;
  if (expectedToken && token !== expectedToken) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // --- Fetch lessons ---
  let lessonsResult;

  if (childId) {
    // Per-child calendar: lessons assigned to this child
    lessonsResult = await pool.query(
      `SELECT l.id, l.title, l.description, l.planned_date, l.status,
              s.name AS subject_name, cu.name AS curriculum_name,
              c.name AS child_name
       FROM lessons l
       JOIN curricula cu ON cu.id = l.curriculum_id
       JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id AND ca.child_id = $1
       JOIN subjects s ON s.id = cu.subject_id
       JOIN children c ON c.id = ca.child_id
       WHERE l.planned_date IS NOT NULL AND l.archived = false
       ORDER BY l.planned_date, s.name, l.order_index`,
      [childId]
    );
  } else {
    // All-children calendar: group children per lesson
    lessonsResult = await pool.query(
      `SELECT l.id, l.title, l.description, l.planned_date, l.status,
              s.name AS subject_name, cu.name AS curriculum_name,
              string_agg(DISTINCT c.name, ', ' ORDER BY c.name) AS child_names
       FROM lessons l
       JOIN curricula cu ON cu.id = l.curriculum_id
       JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id
       JOIN subjects s ON s.id = cu.subject_id
       JOIN children c ON c.id = ca.child_id
       WHERE l.planned_date IS NOT NULL AND l.archived = false
       GROUP BY l.id, l.title, l.description, l.planned_date, l.status,
                s.name, cu.name
       ORDER BY l.planned_date, s.name, l.order_index`
    );
  }

  // --- Fetch external events ---
  let eventsResult;

  if (childId) {
    // Only events linked to this child (or events with no child filter)
    eventsResult = await pool.query(
      `SELECT ee.id, ee.title, ee.description, ee.start_time, ee.end_time,
              ee.location, ee.category, ee.recurrence_type,
              ee.day_of_week, ee.start_date, ee.end_date, ee.all_day, ee.color
       FROM external_events ee
       WHERE ee.end_date >= CURRENT_DATE - interval '30 days'
         AND (
           EXISTS (SELECT 1 FROM external_event_children eec WHERE eec.external_event_id = ee.id AND eec.child_id = $1)
           OR NOT EXISTS (SELECT 1 FROM external_event_children eec WHERE eec.external_event_id = ee.id)
         )
       ORDER BY ee.start_date`,
      [childId]
    );
  } else {
    eventsResult = await pool.query(
      `SELECT ee.id, ee.title, ee.description, ee.start_time, ee.end_time,
              ee.location, ee.category, ee.recurrence_type,
              ee.day_of_week, ee.start_date, ee.end_date, ee.all_day, ee.color
       FROM external_events ee
       WHERE ee.end_date >= CURRENT_DATE - interval '30 days'
       ORDER BY ee.start_date`
    );
  }

  // Fetch exceptions for external events
  const eventIds = eventsResult.rows.map(
    (e: { id: string }) => e.id
  );
  let exceptionsMap: Record<string, string[]> = {};
  if (eventIds.length > 0) {
    const exRes = await pool.query(
      `SELECT external_event_id, exception_date::text
       FROM external_event_exceptions
       WHERE external_event_id = ANY($1)`,
      [eventIds]
    );
    for (const row of exRes.rows) {
      if (!exceptionsMap[row.external_event_id]) {
        exceptionsMap[row.external_event_id] = [];
      }
      exceptionsMap[row.external_event_id].push(row.exception_date);
    }
  }

  // --- Build iCal ---
  const now = formatIcalDateTime(new Date());
  const calName = childId
    ? `Harmony - ${lessonsResult.rows[0]?.child_name || "Child"}`
    : "Harmony Homeschool";

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Harmony Homeschool//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcal(calName)}`,
  ];

  // Lesson events
  for (const row of lessonsResult.rows) {
    const dateStr = String(row.planned_date);
    const dtStart = formatIcalDate(dateStr);
    // All-day event: DTEND is next day
    const endDate = new Date(dateStr);
    endDate.setDate(endDate.getDate() + 1);
    const dtEnd = formatIcalDate(
      `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`
    );

    const childLabel = row.child_name || row.child_names || "";
    const summary = escapeIcal(
      `[${row.subject_name}] ${row.title} - ${childLabel}`
    );
    const descParts = [row.curriculum_name, row.description || ""].filter(
      Boolean
    );
    const description = escapeIcal(descParts.join("\n\n"));

    const status = row.status === "completed" ? "COMPLETED" : "CONFIRMED";

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:lesson-${row.id}@harmony-homeschool`);
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(`SUMMARY:${summary}`);
    lines.push(`DESCRIPTION:${description}`);
    lines.push(`STATUS:${status}`);
    // Reminder 1 day before
    lines.push("BEGIN:VALARM");
    lines.push("TRIGGER:-P1D");
    lines.push("ACTION:DISPLAY");
    lines.push("DESCRIPTION:Lesson tomorrow");
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }

  // External events
  for (const event of eventsResult.rows) {
    const startDateStr = String(event.start_date);
    const startDate = formatIcalDate(startDateStr);

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:event-${event.id}@harmony-homeschool`);
    lines.push(`DTSTAMP:${now}`);

    if (event.all_day || !event.start_time) {
      // All-day event
      lines.push(`DTSTART;VALUE=DATE:${startDate}`);
      if (event.end_date && event.end_date !== event.start_date) {
        // All-day events: DTEND is exclusive, add 1 day
        const ed = new Date(String(event.end_date));
        ed.setDate(ed.getDate() + 1);
        const edStr = `${ed.getFullYear()}-${String(ed.getMonth() + 1).padStart(2, "0")}-${String(ed.getDate()).padStart(2, "0")}`;
        lines.push(`DTEND;VALUE=DATE:${formatIcalDate(edStr)}`);
      }
    } else {
      // Timed event
      const startTime = formatTimeToIcal(event.start_time);
      lines.push(`DTSTART:${startDate}T${startTime}`);
      if (event.end_time) {
        const endTime = formatTimeToIcal(event.end_time);
        lines.push(`DTEND:${startDate}T${endTime}`);
      }
    }

    lines.push(`SUMMARY:${escapeIcal(event.title)}`);
    if (event.description) {
      lines.push(`DESCRIPTION:${escapeIcal(event.description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeIcal(event.location)}`);
    }
    if (event.category) {
      lines.push(`CATEGORIES:${event.category}`);
    }

    // Recurrence rules
    if (
      event.recurrence_type === "weekly" &&
      event.day_of_week !== null &&
      event.end_date
    ) {
      const endDateIcal = formatIcalDate(String(event.end_date));
      const dayAbbr = DAY_MAP[event.day_of_week];
      if (dayAbbr) {
        lines.push(
          `RRULE:FREQ=WEEKLY;BYDAY=${dayAbbr};UNTIL=${endDateIcal}`
        );
      }
    } else if (
      event.recurrence_type === "biweekly" &&
      event.day_of_week !== null &&
      event.end_date
    ) {
      const endDateIcal = formatIcalDate(String(event.end_date));
      const dayAbbr = DAY_MAP[event.day_of_week];
      if (dayAbbr) {
        lines.push(
          `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayAbbr};UNTIL=${endDateIcal}`
        );
      }
    } else if (event.recurrence_type === "monthly" && event.end_date) {
      const endDateIcal = formatIcalDate(String(event.end_date));
      lines.push(`RRULE:FREQ=MONTHLY;UNTIL=${endDateIcal}`);
    }

    // Exception dates (cancelled occurrences)
    const exceptions = exceptionsMap[event.id];
    if (exceptions && exceptions.length > 0) {
      const exDates = exceptions
        .map((d) => {
          if (event.start_time) {
            return `${formatIcalDate(d)}T${formatTimeToIcal(event.start_time)}`;
          }
          return formatIcalDate(d);
        })
        .join(",");
      if (event.start_time) {
        lines.push(`EXDATE:${exDates}`);
      } else {
        lines.push(`EXDATE;VALUE=DATE:${exDates}`);
      }
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const ical = lines.join("\r\n");

  return new NextResponse(ical, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="harmony.ics"',
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
