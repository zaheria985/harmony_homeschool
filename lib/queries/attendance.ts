import pool from "@/lib/db";

/**
 * Attendance and instructional hours, for state reporting.
 *
 * A day is *derived* as attended when the child completed at least one lesson
 * scheduled for that day — so normal use of the app produces the record with no
 * extra bookkeeping. Rows in `attendance_days` are exceptions layered on top:
 *
 *   - status 'absent'/'holiday' removes a day that would otherwise count
 *   - status 'present' adds a day with no lesson records (a field trip)
 *   - `minutes` overrides the per-day default for that one day
 */

export type AttendanceDay = {
  date: string;
  source: "derived" | "override";
  status: "present" | "absent" | "holiday";
  minutes: number;
  lessonsCompleted: number;
  note: string | null;
};

export type AttendanceSummary = {
  childId: string;
  childName: string;
  daysAttended: number;
  totalMinutes: number;
  totalHours: number;
  defaultMinutesPerDay: number;
  days: AttendanceDay[];
};

export async function getInstructionalMinutesPerDay(): Promise<number> {
  const res = await pool.query(
    "SELECT value FROM app_settings WHERE key = 'instructional_minutes_per_day'",
  );
  const parsed = Number(res.rows[0]?.value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 240;
}

export async function setInstructionalMinutesPerDay(
  minutes: number,
): Promise<void> {
  await pool.query(
    `INSERT INTO app_settings (key, value, updated_at)
     VALUES ('instructional_minutes_per_day', $1, now())
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [String(minutes)],
  );
}

export async function getAttendanceSummary(
  childId: string,
  startDate: string,
  endDate: string,
): Promise<AttendanceSummary | null> {
  const childRes = await pool.query(
    "SELECT id::text, name FROM children WHERE id = $1",
    [childId],
  );
  const child = childRes.rows[0];
  if (!child) return null;

  const defaultMinutes = await getInstructionalMinutesPerDay();

  // Days with completed work, counted by the lesson's scheduled date so
  // attendance follows the school calendar rather than when a parent happened
  // to tick the box.
  const derivedRes = await pool.query(
    `SELECT l.planned_date::text AS date, COUNT(*)::int AS lessons
     FROM lesson_completions lc
     JOIN lessons l ON l.id = lc.lesson_id
     WHERE lc.child_id = $1
       AND l.planned_date BETWEEN $2::date AND $3::date
     GROUP BY l.planned_date
     ORDER BY l.planned_date`,
    [childId, startDate, endDate],
  );

  const overrideRes = await pool.query(
    `SELECT date::text, status, minutes, note
     FROM attendance_days
     WHERE child_id = $1 AND date BETWEEN $2::date AND $3::date`,
    [childId, startDate, endDate],
  );

  const overrides = new Map<
    string,
    { status: "present" | "absent" | "holiday"; minutes: number | null; note: string | null }
  >();
  for (const row of overrideRes.rows as {
    date: string;
    status: "present" | "absent" | "holiday";
    minutes: number | null;
    note: string | null;
  }[]) {
    overrides.set(row.date, {
      status: row.status,
      minutes: row.minutes,
      note: row.note,
    });
  }

  const lessonsByDate = new Map<string, number>();
  for (const row of derivedRes.rows as { date: string; lessons: number }[]) {
    lessonsByDate.set(row.date, row.lessons);
  }

  // Union of both sources so an override-only day (field trip) still appears.
  const allDates = Array.from(
    new Set([...lessonsByDate.keys(), ...overrides.keys()]),
  ).sort();

  const days: AttendanceDay[] = [];
  let daysAttended = 0;
  let totalMinutes = 0;

  for (const date of allDates) {
    const override = overrides.get(date);
    const lessonsCompleted = lessonsByDate.get(date) ?? 0;

    const status = override?.status ?? "present";
    const counts = status === "present";
    const minutes = counts ? (override?.minutes ?? defaultMinutes) : 0;

    if (counts) {
      daysAttended += 1;
      totalMinutes += minutes;
    }

    days.push({
      date,
      source: override ? "override" : "derived",
      status,
      minutes,
      lessonsCompleted,
      note: override?.note ?? null,
    });
  }

  return {
    childId: child.id,
    childName: child.name,
    daysAttended,
    totalMinutes,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    defaultMinutesPerDay: defaultMinutes,
    days,
  };
}
