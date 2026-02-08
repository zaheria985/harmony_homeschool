"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";

function revalidateCalendar() {
  revalidatePath("/admin/calendar");
  revalidatePath("/admin");
  revalidatePath("/week");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
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
  const parsedDays = z.array(z.number().int().min(0).max(6)).safeParse(weekdays);
  if (!parsedId.success || !parsedDays.success) return { error: "Invalid input" };

  // Replace all school days for this year
  await pool.query("DELETE FROM school_days WHERE school_year_id = $1", [parsedId.data]);
  for (const weekday of parsedDays.data) {
    await pool.query(
      `INSERT INTO school_days (school_year_id, weekday) VALUES ($1, $2)`,
      [parsedId.data, weekday]
    );
  }

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
  } catch {
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
