"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import pool from "@/lib/db";
import { requireParent } from "@/lib/server/authz";
import { setInstructionalMinutesPerDay } from "@/lib/queries/attendance";

const overrideSchema = z.object({
  childId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date"),
  status: z.enum(["present", "absent", "holiday"]),
  minutes: z.number().int().min(0).max(1440).nullable(),
  note: z.string().max(500).nullable(),
});

/** Add or update an attendance exception for one child-day. */
export async function setAttendanceOverride(
  childId: string,
  date: string,
  status: string,
  minutes: number | null,
  note: string | null,
) {
  const user = await requireParent();
  if (!user) return { error: "Unauthorized" };

  const parsed = overrideSchema.safeParse({
    childId,
    date,
    status,
    minutes,
    note,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  await pool.query(
    `INSERT INTO attendance_days (child_id, date, status, minutes, note)
     VALUES ($1, $2::date, $3, $4, $5)
     ON CONFLICT (child_id, date) DO UPDATE
       SET status = $3, minutes = $4, note = $5`,
    [
      parsed.data.childId,
      parsed.data.date,
      parsed.data.status,
      parsed.data.minutes,
      parsed.data.note,
    ],
  );

  revalidatePath("/reports/attendance");
  return { success: true };
}

/** Remove an exception, returning the day to its derived value. */
export async function clearAttendanceOverride(childId: string, date: string) {
  const user = await requireParent();
  if (!user) return { error: "Unauthorized" };

  const parsed = z
    .object({
      childId: z.string().uuid(),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    })
    .safeParse({ childId, date });
  if (!parsed.success) return { error: "Invalid input" };

  await pool.query(
    "DELETE FROM attendance_days WHERE child_id = $1 AND date = $2::date",
    [parsed.data.childId, parsed.data.date],
  );

  revalidatePath("/reports/attendance");
  return { success: true };
}

export async function updateInstructionalMinutes(minutes: number) {
  const user = await requireParent();
  if (!user) return { error: "Unauthorized" };

  const parsed = z.number().int().min(1).max(1440).safeParse(minutes);
  if (!parsed.success) {
    return { error: "Minutes per day must be between 1 and 1440" };
  }

  await setInstructionalMinutesPerDay(parsed.data);
  revalidatePath("/reports/attendance");
  return { success: true };
}
