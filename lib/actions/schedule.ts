"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";
import {
  addDays,
  formatDateKey,
  isSchoolDate,
  parseDateKey,
} from "@/lib/utils/school-dates";

const setAssignmentDaysSchema = z.object({
  assignmentId: z.string().uuid(),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7),
});

const autoScheduleSchema = z.object({
  curriculumId: z.string().uuid(),
  childId: z.string().uuid(),
});


export async function setAssignmentDays(assignmentId: string, weekdays: number[]) {
  const parsed = setAssignmentDaysSchema.safeParse({ assignmentId, weekdays });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const uniqueWeekdays = Array.from(new Set(parsed.data.weekdays)).sort((a, b) => a - b);

  const assignmentRes = await pool.query(
    `SELECT curriculum_id FROM curriculum_assignments WHERE id = $1`,
    [parsed.data.assignmentId]
  );
  if (!assignmentRes.rows[0]) {
    return { error: "Assignment not found" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM curriculum_assignment_days WHERE assignment_id = $1",
      [parsed.data.assignmentId]
    );

    for (const weekday of uniqueWeekdays) {
      await client.query(
        `INSERT INTO curriculum_assignment_days (assignment_id, weekday)
         VALUES ($1, $2)`,
        [parsed.data.assignmentId, weekday]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to update assignment weekdays", {
      assignmentId: parsed.data.assignmentId,
      weekdays: uniqueWeekdays,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to update schedule days" };
  } finally {
    client.release();
  }

  const curriculumId = assignmentRes.rows[0].curriculum_id as string;
  revalidatePath("/curricula");
  revalidatePath(`/curricula/${curriculumId}`);
  revalidatePath("/admin/curricula");

  return { success: true };
}

export async function clearSchedule(curriculumId: string) {
  const parsed = z.string().uuid().safeParse(curriculumId);
  if (!parsed.success) return { error: "Invalid curriculum ID" };

  const result = await pool.query(
    `UPDATE lessons
     SET planned_date = NULL
     WHERE curriculum_id = $1
       AND status != 'completed'
     RETURNING id`,
    [parsed.data]
  );

  revalidatePath("/curricula");
  revalidatePath(`/curricula/${parsed.data}`);
  revalidatePath("/week");
  revalidatePath("/calendar");

  return { success: true, cleared: result.rowCount };
}

export async function rescheduleAllLessons(curriculumId: string, childId: string) {
  const parsed = autoScheduleSchema.safeParse({ curriculumId, childId });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message || "Invalid input" };

  // Clear all non-completed lesson dates first
  await pool.query(
    `UPDATE lessons
     SET planned_date = NULL
     WHERE curriculum_id = $1
       AND status != 'completed'`,
    [parsed.data.curriculumId]
  );

  // Then run the normal auto-schedule which picks up all unscheduled lessons
  return autoScheduleLessons(parsed.data.curriculumId, parsed.data.childId);
}

export async function autoScheduleLessons(curriculumId: string, childId: string) {
  const parsed = autoScheduleSchema.safeParse({ curriculumId, childId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const activeAssignmentRes = await pool.query(
    `SELECT ca.id, ca.school_year_id, sy.start_date::text AS start_date, sy.end_date::text AS end_date
     FROM curriculum_assignments ca
     JOIN school_years sy ON sy.id = ca.school_year_id
     WHERE ca.curriculum_id = $1
       AND ca.child_id = $2
       AND CURRENT_DATE BETWEEN sy.start_date AND sy.end_date
     ORDER BY sy.start_date DESC
     LIMIT 1`,
    [parsed.data.curriculumId, parsed.data.childId]
  );

  // Prefer an assignment for the currently active school year, but fall back
  // to the most recent assignment to keep the auto-schedule action usable.
  const assignmentRes =
    activeAssignmentRes.rows[0] ||
    (
      await pool.query(
        `SELECT ca.id, ca.school_year_id, sy.start_date::text AS start_date, sy.end_date::text AS end_date
         FROM curriculum_assignments ca
         JOIN school_years sy ON sy.id = ca.school_year_id
         WHERE ca.curriculum_id = $1
           AND ca.child_id = $2
         ORDER BY sy.end_date DESC
         LIMIT 1`,
        [parsed.data.curriculumId, parsed.data.childId]
      )
    ).rows[0];

  if (!assignmentRes) {
    return { error: "Assignment not found" };
  }

  const assignmentDaysRes = await pool.query(
    `SELECT weekday FROM curriculum_assignment_days WHERE assignment_id = $1 ORDER BY weekday`,
    [assignmentRes.id]
  );

  const usesCustomWeekdays = assignmentDaysRes.rows.length > 0;

  const weekdays =
    usesCustomWeekdays
      ? assignmentDaysRes.rows.map((row: { weekday: number }) => row.weekday)
      : (
          await pool.query(
            `SELECT weekday FROM school_days WHERE school_year_id = $1 ORDER BY weekday`,
            [assignmentRes.school_year_id]
          )
        ).rows.map((row: { weekday: number }) => row.weekday);

  if (weekdays.length === 0) {
    return { error: "No schedule days configured" };
  }

  const overridesRes = await pool.query(
    `SELECT date::text, type FROM date_overrides WHERE school_year_id = $1`,
    [assignmentRes.school_year_id]
  );

  const lessonsRes = await pool.query(
    `SELECT id
     FROM lessons
     WHERE curriculum_id = $1
       AND planned_date IS NULL
       AND status != 'completed'
     ORDER BY order_index ASC, id ASC`,
    [parsed.data.curriculumId]
  );

  if (lessonsRes.rows.length === 0) {
    return { error: "No unscheduled lessons" };
  }

  const overrides = new Map<string, "exclude" | "include">();
  for (const row of overridesRes.rows as { date: string; type: "exclude" | "include" }[]) {
    overrides.set(row.date, row.type);
  }

  const weekdaySet = new Set<number>(weekdays);
  const todayKey = formatDateKey(new Date());
  const startKey = todayKey > assignmentRes.start_date ? todayKey : assignmentRes.start_date;

  let cursor = parseDateKey(startKey);
  const endDate = parseDateKey(assignmentRes.end_date);

  const updates: Array<{ lessonId: string; plannedDate: string }> = [];

  // Assign each unscheduled lesson to the next valid school day in sequence.
  for (const lesson of lessonsRes.rows as { id: string }[]) {
    let assignedDate: string | null = null;

    while (cursor.getTime() <= endDate.getTime()) {
      const matchesCustomWeekday = weekdaySet.has(cursor.getDay());
      const isAllowedDate = usesCustomWeekdays
        ? matchesCustomWeekday
        : isSchoolDate(cursor, weekdaySet, overrides);
      if (isAllowedDate) {
        assignedDate = formatDateKey(cursor);
        cursor = addDays(cursor, 1);
        break;
      }
      cursor = addDays(cursor, 1);
    }

    if (!assignedDate) {
      break;
    }

    updates.push({ lessonId: lesson.id, plannedDate: assignedDate });
  }

  if (updates.length === 0) {
    return { error: "No available dates in this school year" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const update of updates) {
      await client.query(
        `UPDATE lessons SET planned_date = $1::date WHERE id = $2`,
        [update.plannedDate, update.lessonId]
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to auto-schedule lessons", {
      curriculumId: parsed.data.curriculumId,
      childId: parsed.data.childId,
      updatesAttempted: updates.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to auto-schedule lessons" };
  } finally {
    client.release();
  }

  revalidatePath("/curricula");
  revalidatePath(`/curricula/${parsed.data.curriculumId}`);
  revalidatePath("/week");
  revalidatePath("/calendar");

  return { success: true, scheduled: updates.length, remaining: lessonsRes.rows.length - updates.length };
}
