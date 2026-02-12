"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";

const DAY_MS = 24 * 60 * 60 * 1000;

function revalidateCalendar() {
  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
  revalidatePath("/week");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
}

function parseDateKey(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

function isSchoolDate(
  date: Date,
  weekdays: Set<number>,
  overrides: Map<string, "exclude" | "include">
): boolean {
  const key = formatDateKey(date);
  const override = overrides.get(key);
  if (override === "include") return true;
  if (override === "exclude") return false;
  return weekdays.has(date.getUTCDay());
}

function nextSchoolDate(
  start: Date,
  weekdays: Set<number>,
  overrides: Map<string, "exclude" | "include">
): Date {
  let cursor = start;
  for (let i = 0; i < 3700; i += 1) {
    if (isSchoolDate(cursor, weekdays, overrides)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return start;
}

async function reflowPlannedLessonsForYear(
  schoolYearId: string,
  weekdays: number[]
) {
  const overridesRes = await pool.query(
    `SELECT date::text, type FROM date_overrides WHERE school_year_id = $1`,
    [schoolYearId]
  );

  const lessonsRes = await pool.query(
    `SELECT l.id, l.planned_date::text AS planned_date, l.order_index
     FROM lessons l
     JOIN curriculum_assignments ca ON ca.curriculum_id = l.curriculum_id
     WHERE ca.school_year_id = $1
       AND l.planned_date IS NOT NULL
     ORDER BY l.planned_date ASC, l.order_index ASC, l.id ASC`,
    [schoolYearId]
  );

  if (lessonsRes.rows.length === 0) {
    return { updated: 0 };
  }

  const weekdaySet = new Set<number>(weekdays);
  const overrides = new Map<string, "exclude" | "include">();
  for (const row of overridesRes.rows as { date: string; type: "exclude" | "include" }[]) {
    overrides.set(row.date, row.type);
  }

  const orderedDates: string[] = [];
  let previousDate = "";
  for (const row of lessonsRes.rows as { planned_date: string }[]) {
    if (row.planned_date !== previousDate) {
      orderedDates.push(row.planned_date);
      previousDate = row.planned_date;
    }
  }

  const remap = new Map<string, string>();
  let cursor = parseDateKey(orderedDates[0]);

  for (const dateKey of orderedDates) {
    const originalDate = parseDateKey(dateKey);
    if (originalDate.getTime() > cursor.getTime()) {
      cursor = originalDate;
    }
    const nextDate = nextSchoolDate(cursor, weekdaySet, overrides);
    remap.set(dateKey, formatDateKey(nextDate));
    cursor = addDays(nextDate, 1);
  }

  let updatedCount = 0;
  for (const [fromDate, toDate] of remap.entries()) {
    if (fromDate === toDate) continue;
    const res = await pool.query(
      `UPDATE lessons l
       SET planned_date = $1::date
       FROM curriculum_assignments ca
       WHERE ca.curriculum_id = l.curriculum_id
         AND ca.school_year_id = $2
         AND l.planned_date = $3::date`,
      [toDate, schoolYearId, fromDate]
    );
    updatedCount += res.rowCount || 0;
  }

  return { updated: updatedCount };
}

// ============================================================================
// SCHOOL YEARS
// ============================================================================

const schoolYearSchema = z.object({
  label: z.string().min(1, "Label is required"),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function createSchoolYear(formData: FormData) {
  const data = schoolYearSchema.safeParse({
    label: formData.get("label"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
  });
  if (!data.success) return { error: data.error.errors[0]?.message || "Invalid input" };

  const { label, start_date, end_date } = data.data;
  if (end_date <= start_date) return { error: "End date must be after start date" };

  const res = await pool.query(
    `INSERT INTO school_years (label, start_date, end_date) VALUES ($1, $2, $3) RETURNING id`,
    [label, start_date, end_date]
  );

  // Default to Mon-Fri
  for (const weekday of [1, 2, 3, 4, 5]) {
    await pool.query(
      `INSERT INTO school_days (school_year_id, weekday) VALUES ($1, $2)`,
      [res.rows[0].id, weekday]
    );
  }

  revalidateCalendar();
  return { success: true, id: res.rows[0].id };
}

export async function deleteSchoolYear(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid ID" };

  await pool.query("DELETE FROM school_years WHERE id = $1", [parsed.data]);
  revalidateCalendar();
  return { success: true };
}

export async function updateSchoolYear(formData: FormData) {
  const data = z
    .object({
      id: z.string().uuid(),
      label: z.string().min(1, "Label is required"),
      start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse({
      id: formData.get("id"),
      label: formData.get("label"),
      start_date: formData.get("start_date"),
      end_date: formData.get("end_date"),
    });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, label, start_date, end_date } = data.data;
  if (end_date <= start_date) return { error: "End date must be after start date" };

  await pool.query(
    `UPDATE school_years
     SET label = $1, start_date = $2, end_date = $3
     WHERE id = $4`,
    [label, start_date, end_date, id]
  );

  revalidateCalendar();
  return { success: true };
}

// ============================================================================
// SCHOOL DAYS (which weekdays are school days)
// ============================================================================

export async function setSchoolDays(schoolYearId: string, weekdays: number[]) {
  const parsedId = z.string().uuid().safeParse(schoolYearId);
  const parsedDays = z
    .array(z.number().int().min(0).max(6))
    .min(1, "Select at least one school day")
    .safeParse(weekdays);
  if (!parsedId.success || !parsedDays.success) return { error: "Invalid input" };

  // Replace all school days for this year
  await pool.query("DELETE FROM school_days WHERE school_year_id = $1", [parsedId.data]);
  for (const weekday of parsedDays.data) {
    await pool.query(
      `INSERT INTO school_days (school_year_id, weekday) VALUES ($1, $2)`,
      [parsedId.data, weekday]
    );
  }

  await reflowPlannedLessonsForYear(parsedId.data, parsedDays.data);

  revalidateCalendar();
  return { success: true };
}

// ============================================================================
// DATE OVERRIDES (holidays, snow days, make-up days)
// ============================================================================

const dateOverrideSchema = z.object({
  school_year_id: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  type: z.enum(["exclude", "include"]),
  reason: z.string().optional(),
});

export async function addDateOverride(formData: FormData) {
  const data = dateOverrideSchema.safeParse({
    school_year_id: formData.get("school_year_id"),
    date: formData.get("date"),
    type: formData.get("type"),
    reason: formData.get("reason") || undefined,
  });
  if (!data.success) return { error: data.error.errors[0]?.message || "Invalid input" };

  try {
    await pool.query(
      `INSERT INTO date_overrides (school_year_id, date, type, reason)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (school_year_id, date) DO UPDATE SET type = $3, reason = $4`,
      [data.data.school_year_id, data.data.date, data.data.type, data.data.reason || null]
    );
  } catch (err) {
    console.error("Failed to add date override", {
      schoolYearId: data.data.school_year_id,
      date: data.data.date,
      type: data.data.type,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to add date override" };
  }

  revalidateCalendar();
  return { success: true };
}

export async function removeDateOverride(id: string) {
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid ID" };

  await pool.query("DELETE FROM date_overrides WHERE id = $1", [parsed.data]);
  revalidateCalendar();
  return { success: true };
}
