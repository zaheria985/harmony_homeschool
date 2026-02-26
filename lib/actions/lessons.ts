"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";
import { saveUploadedImage } from "@/lib/server/uploads";
import { getCurrentUser } from "@/lib/session";
import {
  addDays,
  formatDateKey,
  nextValidSchoolDate,
  parseDateKey,
  isSchoolDate,
} from "@/lib/utils/school-dates";

/** Revalidate all routes that display lesson/curriculum/subject data */
function revalidateAll() {
  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/calendar");
  revalidatePath("/dashboard");
  revalidatePath("/subjects");
  revalidatePath("/curricula");
  revalidatePath("/grades");
  revalidatePath("/students");
  revalidatePath("/reports");
  revalidatePath("/resources");
  revalidatePath("/admin");
}

const statusSchema = z.enum(["planned", "in_progress", "completed"]);
const optionalDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional();

export async function updateLessonStatus(id: string, status: string) {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success) {
    return { error: "Invalid status" };
  }

  try {
    await pool.query("UPDATE lessons SET status = $1 WHERE id = $2", [
      parsed.data,
      id,
    ]);
  } catch (err) {
    console.error("Failed to update lesson status", {
      lessonId: id,
      status: parsed.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to update lesson status" };
  }

  revalidateAll();
  return { success: true };
}

const rescheduleSchema = z.object({
  lessonId: z.string().uuid(),
  newDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function rescheduleLesson(lessonId: string, newDate: string) {
  const parsed = rescheduleSchema.safeParse({ lessonId, newDate });
  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  try {
    // Get the lesson's curriculum and order_index
    const lessonRes = await pool.query(
      `SELECT planned_date::text, curriculum_id, order_index FROM lessons WHERE id = $1`,
      [parsed.data.lessonId]
    );
    const lesson = lessonRes.rows[0];
    if (!lesson) return { error: "Lesson not found" };

    // Move the dragged lesson
    await pool.query(
      "UPDATE lessons SET planned_date = $1 WHERE id = $2",
      [parsed.data.newDate, parsed.data.lessonId]
    );

    // Get subsequent lessons that need cascading
    const subsequentRes = await pool.query(
      `SELECT id
       FROM lessons
       WHERE curriculum_id = $1
         AND id != $2
         AND order_index > $3
         AND planned_date IS NOT NULL
         AND status != 'completed'
       ORDER BY order_index ASC, id ASC`,
      [lesson.curriculum_id, parsed.data.lessonId, lesson.order_index]
    );

    if (subsequentRes.rows.length > 0) {
      // Look up the course's custom weekdays (or fall back to school days)
      const assignmentRes = await pool.query(
        `SELECT ca.id, ca.school_year_id
         FROM curriculum_assignments ca
         JOIN school_years sy ON sy.id = ca.school_year_id
         WHERE ca.curriculum_id = $1
         ORDER BY sy.end_date DESC
         LIMIT 1`,
        [lesson.curriculum_id]
      );

      let weekdaySet: Set<number>;
      let overrides = new Map<string, "exclude" | "include">();
      let usesCustomWeekdays = false;

      if (assignmentRes.rows[0]) {
        const assignment = assignmentRes.rows[0];

        const customDaysRes = await pool.query(
          `SELECT weekday FROM curriculum_assignment_days WHERE assignment_id = $1`,
          [assignment.id]
        );

        usesCustomWeekdays = customDaysRes.rows.length > 0;

        if (usesCustomWeekdays) {
          weekdaySet = new Set(customDaysRes.rows.map((r: { weekday: number }) => r.weekday));
        } else {
          const schoolDaysRes = await pool.query(
            `SELECT weekday FROM school_days WHERE school_year_id = $1`,
            [assignment.school_year_id]
          );
          weekdaySet = new Set(schoolDaysRes.rows.map((r: { weekday: number }) => r.weekday));
        }

        if (!usesCustomWeekdays) {
          const overridesRes = await pool.query(
            `SELECT date::text, type FROM date_overrides WHERE school_year_id = $1`,
            [assignment.school_year_id]
          );
          for (const row of overridesRes.rows as { date: string; type: "exclude" | "include" }[]) {
            overrides.set(row.date, row.type);
          }
        }
      } else {
        // No assignment found — default to weekdays Mon-Fri
        weekdaySet = new Set([1, 2, 3, 4, 5]);
      }

      // Re-slot subsequent lessons onto valid days starting after the moved lesson
      const { parseDateKey, addDays, formatDateKey, isSchoolDate } = await import("@/lib/utils/school-dates");
      let cursor = addDays(parseDateKey(parsed.data.newDate), 1);

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const row of subsequentRes.rows as { id: string }[]) {
          // Find next valid day
          for (let i = 0; i < 3660; i++) {
            const isValid = usesCustomWeekdays
              ? weekdaySet.has(cursor.getUTCDay())
              : isSchoolDate(cursor, weekdaySet, overrides);
            if (isValid) break;
            cursor = addDays(cursor, 1);
          }
          await client.query(
            `UPDATE lessons SET planned_date = $1::date WHERE id = $2`,
            [formatDateKey(cursor), row.id]
          );
          cursor = addDays(cursor, 1);
        }
        await client.query("COMMIT");
      } catch (err) {
        await client.query("ROLLBACK");
        throw err;
      } finally {
        client.release();
      }
    }
  } catch (err) {
    console.error("Failed to reschedule lesson", {
      lessonId: parsed.data.lessonId,
      newDate: parsed.data.newDate,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to reschedule lesson" };
  }

  revalidateAll();
  return { success: true };
}

/**
 * Move overdue incomplete lessons to today (or next school day).
 * Called lazily on page load. Idempotent.
 */
export async function bumpOverdueLessons(childId: string, today: string, includeToday = false) {
  const parsed = z.string().uuid().safeParse(childId);
  if (!parsed.success) return { error: "Invalid childId" };

  const assignmentsRes = await pool.query(
    `SELECT
       ca.id,
       ca.curriculum_id,
       ca.school_year_id,
       COALESCE(
         NULLIF((
           SELECT ARRAY_AGG(cad.weekday ORDER BY cad.weekday)
           FROM curriculum_assignment_days cad
           WHERE cad.assignment_id = ca.id
         ), '{}'),
         (
           SELECT ARRAY_AGG(sd.weekday ORDER BY sd.weekday)
           FROM school_days sd
           WHERE sd.school_year_id = ca.school_year_id
         )
       ) AS weekdays
     FROM curriculum_assignments ca
     WHERE ca.child_id = $1`,
    [childId]
  );

  const thresholdOp = includeToday ? "<=" : "<";
  let bumped = 0;

  // Process each curriculum assignment independently so rescheduling preserves
  // the assignment's weekday/override constraints.
  for (const assignment of assignmentsRes.rows as {
    id: string;
    curriculum_id: string;
    school_year_id: string;
    weekdays: number[] | null;
  }[]) {
    const weekdays = assignment.weekdays || [];
    if (weekdays.length === 0) continue;

    const lessonsRes = await pool.query(
      `SELECT l.id, l.planned_date::text AS planned_date, l.order_index
       FROM lessons l
       WHERE l.curriculum_id = $1
         AND l.status != 'completed'
         AND l.planned_date IS NOT NULL
       ORDER BY l.planned_date ASC, l.order_index ASC, l.id ASC`,
      [assignment.curriculum_id]
    );

    if (lessonsRes.rows.length === 0) continue;

    // We only reschedule the first overdue lesson and everything after it,
    // preserving order while moving the sequence forward to valid school days.
    const firstAffectedIndex = (lessonsRes.rows as { planned_date: string }[]).findIndex((lesson) =>
      includeToday ? lesson.planned_date <= today : lesson.planned_date < today
    );

    if (firstAffectedIndex < 0) continue;

    const overridesRes = await pool.query(
      `SELECT date::text, type
       FROM date_overrides
       WHERE school_year_id = $1`,
      [assignment.school_year_id]
    );
    const overrides = new Map<string, "exclude" | "include">();
    for (const row of overridesRes.rows as { date: string; type: "exclude" | "include" }[]) {
      overrides.set(row.date, row.type);
    }

    const weekdaySet = new Set<number>(weekdays);
    let cursor = parseDateKey(includeToday ? formatDateKey(addDays(parseDateKey(today), 1)) : today);
    const affected = lessonsRes.rows.slice(firstAffectedIndex) as Array<{
      id: string;
      planned_date: string;
      order_index: number;
    }>;
    const updates: Array<{ id: string; plannedDate: string }> = [];

    for (const lesson of affected) {
      const nextDate = nextValidSchoolDate(cursor, weekdaySet, overrides);
      const nextDateKey = formatDateKey(nextDate);
      cursor = addDays(nextDate, 1);

      if (lesson.planned_date === nextDateKey) continue;
      updates.push({ id: lesson.id, plannedDate: nextDateKey });
    }

    if (updates.length > 0) {
      const ids = updates.map((update) => update.id);
      const dates = updates.map((update) => update.plannedDate);
      const updateRes = await pool.query(
        `UPDATE lessons AS l
         SET planned_date = u.planned_date::date
         FROM (
           SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::text[]) AS planned_date
         ) AS u
         WHERE l.id = u.id
           AND l.planned_date IS DISTINCT FROM u.planned_date::date`,
        [ids, dates]
      );
      bumped += updateRes.rowCount || 0;
    }
  }

  if (bumped > 0) {
    revalidateAll();
  }

  return { success: true, bumped };
}

export async function bumpOverdueLessonsForAll(today: string, includeToday = true) {
  const dateOk = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(today);
  if (!dateOk.success) return { error: "Invalid date" };

  const childrenRes = await pool.query("SELECT id FROM children");
  let bumped = 0;

  for (const row of childrenRes.rows as { id: string }[]) {
    const result = await bumpOverdueLessons(row.id, today, includeToday);
    if ("bumped" in result && typeof result.bumped === "number") bumped += result.bumped;
  }

  return { success: true, bumped };
}

/**
 * After completing a lesson early, shift remaining lessons in the same
 * curriculum backward to fill the gap, respecting weekday constraints.
 */
export async function shiftLessonsAfterCompletion(lessonId: string, childId: string) {
  // Get the completed lesson's curriculum and planned date
  const lessonRes = await pool.query(
    `SELECT l.curriculum_id, l.planned_date::text AS planned_date
     FROM lessons l WHERE l.id = $1`,
    [lessonId]
  );
  if (!lessonRes.rows[0]?.planned_date) return { success: true, shifted: 0 };

  const { curriculum_id, planned_date } = lessonRes.rows[0];

  // If the lesson being completed is for today, don't shift subsequent lessons.
  // Shifting should only happen when completing a FUTURE lesson early (to fill
  // the gap). Completing today's work shouldn't pull tomorrow's lessons forward.
  const today = formatDateKey(new Date());
  if (planned_date <= today) return { success: true, shifted: 0 };

  // Get the curriculum assignment for this child to find weekday constraints
  const assignmentRes = await pool.query(
    `SELECT
       ca.id, ca.school_year_id,
       COALESCE(
         NULLIF((
           SELECT ARRAY_AGG(cad.weekday ORDER BY cad.weekday)
           FROM curriculum_assignment_days cad
           WHERE cad.assignment_id = ca.id
         ), '{}'),
         (
           SELECT ARRAY_AGG(sd.weekday ORDER BY sd.weekday)
           FROM school_days sd
           WHERE sd.school_year_id = ca.school_year_id
         )
       ) AS weekdays
     FROM curriculum_assignments ca
     WHERE ca.curriculum_id = $1 AND ca.child_id = $2
     LIMIT 1`,
    [curriculum_id, childId]
  );

  const assignment = assignmentRes.rows[0];
  if (!assignment) return { success: true, shifted: 0 };

  const weekdays = assignment.weekdays || [];
  if (weekdays.length === 0) return { success: true, shifted: 0 };

  // Get all remaining incomplete lessons in this curriculum, ordered by date
  const remainingRes = await pool.query(
    `SELECT l.id, l.planned_date::text AS planned_date, l.order_index
     FROM lessons l
     WHERE l.curriculum_id = $1
       AND l.status != 'completed'
       AND l.planned_date IS NOT NULL
     ORDER BY l.planned_date ASC, l.order_index ASC, l.id ASC`,
    [curriculum_id]
  );

  if (remainingRes.rows.length === 0) return { success: true, shifted: 0 };

  // Get date overrides
  const overridesRes = await pool.query(
    `SELECT date::text, type FROM date_overrides WHERE school_year_id = $1`,
    [assignment.school_year_id]
  );
  const overrides = new Map<string, "exclude" | "include">();
  for (const row of overridesRes.rows as { date: string; type: "exclude" | "include" }[]) {
    overrides.set(row.date, row.type);
  }

  const weekdaySet = new Set<number>(weekdays);

  // Start assigning from the completed lesson's original date
  let cursor = parseDateKey(planned_date);
  const updates: Array<{ id: string; plannedDate: string }> = [];

  for (const lesson of remainingRes.rows as Array<{ id: string; planned_date: string; order_index: number }>) {
    const nextDate = nextValidSchoolDate(cursor, weekdaySet, overrides);
    const nextDateKey = formatDateKey(nextDate);
    cursor = addDays(nextDate, 1);

    if (lesson.planned_date === nextDateKey) continue;
    updates.push({ id: lesson.id, plannedDate: nextDateKey });
  }

  if (updates.length > 0) {
    const ids = updates.map((u) => u.id);
    const dates = updates.map((u) => u.plannedDate);
    await pool.query(
      `UPDATE lessons AS l
       SET planned_date = u.planned_date::date
       FROM (
         SELECT UNNEST($1::uuid[]) AS id, UNNEST($2::text[]) AS planned_date
       ) AS u
       WHERE l.id = u.id
         AND l.planned_date IS DISTINCT FROM u.planned_date::date`,
      [ids, dates]
    );
  }

  if (updates.length > 0) {
    revalidateAll();
  }

  return { success: true, shifted: updates.length };
}

export async function updateLessonTitle(id: string, title: string) {
  const parsedId = z.string().uuid().safeParse(id);
  const parsedTitle = z.string().min(1).safeParse(title);
  if (!parsedId.success || !parsedTitle.success) return { error: "Invalid input" };

  try {
    await pool.query("UPDATE lessons SET title = $1 WHERE id = $2", [
      parsedTitle.data,
      parsedId.data,
    ]);
  } catch (err) {
    console.error("Failed to update lesson title", { id: parsedId.data, error: err instanceof Error ? err.message : String(err) });
    return { error: "Failed to update lesson title" };
  }

  revalidateAll();
  return { success: true };
}

export async function bulkUpdateLessonDate(lessonIds: string[], newDate: string) {
  const parsedDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).safeParse(newDate);
  const parsedIds = z.array(z.string().uuid()).min(1).safeParse(lessonIds);
  if (!parsedDate.success || !parsedIds.success) return { error: "Invalid input" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE lessons
       SET planned_date = $2
       WHERE id = ANY($1::uuid[])`,
      [parsedIds.data, parsedDate.data]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed bulk lesson date update", {
      lessonCount: parsedIds.data.length,
      newDate: parsedDate.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to update lesson dates" };
  } finally {
    client.release();
  }

  revalidateAll();
  return { success: true };
}

export async function bulkUpdateLessonStatus(lessonIds: string[], status: string) {
  const parsedStatus = statusSchema.safeParse(status);
  const parsedIds = z.array(z.string().uuid()).min(1).safeParse(lessonIds);
  if (!parsedStatus.success || !parsedIds.success) return { error: "Invalid input" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE lessons
       SET status = $2
       WHERE id = ANY($1::uuid[])`,
      [parsedIds.data, parsedStatus.data]
    );
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed bulk lesson status update", {
      lessonCount: parsedIds.data.length,
      status: parsedStatus.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to update lesson statuses" };
  } finally {
    client.release();
  }

  revalidateAll();
  return { success: true };
}

const createLessonSchema = z.object({
  title: z.string().min(1, "Title is required"),
  curriculum_id: z.string().uuid(),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  description: z.string().optional(),
  section: z.string().optional(),
  grade_weight: z.coerce.number().min(0.1).max(10).default(1.0),
  is_recurring: z.coerce.boolean().default(false),
  recurrence_rule: z.enum(["daily", "weekly", "MWF", "TTh"]).optional(),
  recurrence_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
});

const bulkLessonItemSchema = z.object({
  title: z.string().trim().min(1, "Title is required"),
  curriculum_id: z.string().uuid(),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  completed_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  pass_fail: z.enum(["pass", "fail"]).optional(),
  description: z.string().optional(),
  status: statusSchema.optional().default("planned"),
  section: z.string().optional(),
});

const bulkCreateLessonsSchema = z.array(bulkLessonItemSchema).min(1).max(2000);
const bulkCreateOptionsSchema = z.object({
  childIds: z.array(z.string().uuid()).optional().default([]),
  schoolYearId: z.string().uuid().optional(),
});

export async function createLesson(formData: FormData) {
  const data = createLessonSchema.safeParse({
    title: formData.get("title"),
    curriculum_id: formData.get("curriculum_id"),
    planned_date: formData.get("planned_date") || undefined,
    description: formData.get("description") || undefined,
    section: formData.get("section") || undefined,
    grade_weight: formData.get("grade_weight") || 1.0,
    is_recurring: formData.get("is_recurring") === "true" || formData.get("is_recurring") === "on",
    recurrence_rule: formData.get("recurrence_rule") || undefined,
    recurrence_end: formData.get("recurrence_end") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { title, curriculum_id, planned_date, description, section, grade_weight, is_recurring, recurrence_rule, recurrence_end } = data.data;

  const res = await pool.query(
    `INSERT INTO lessons (title, curriculum_id, planned_date, description, section, grade_weight, is_recurring, recurrence_rule, recurrence_end)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
    [title, curriculum_id, planned_date || null, description || null, section || null, grade_weight, is_recurring, recurrence_rule || null, recurrence_end || null]
  );

  const lessonId = res.rows[0].id;
  const rawTags = formData.get("tags");
  if (typeof rawTags === "string" && rawTags.trim()) {
    const { parseTagNames } = await import("@/lib/utils/resource-tags");
    const tagNames = parseTagNames(rawTags);
    for (const tagName of tagNames) {
      const tagRes = await pool.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [tagName]
      );
      await pool.query(
        `INSERT INTO lesson_tags (lesson_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [lessonId, tagRes.rows[0].id]
      );
    }
  }

  revalidateAll();
  return { success: true, id: lessonId };
}

export async function bulkCreateLessons(
  lessons: Array<{
    title: string;
    curriculum_id: string;
    planned_date?: string;
    completed_date?: string;
    pass_fail?: "pass" | "fail";
    description?: string;
    status?: "planned" | "in_progress" | "completed";
    section?: string;
  }>,
  options?: { childIds?: string[]; schoolYearId?: string }
) {
  const data = bulkCreateLessonsSchema.safeParse(lessons);
  const opts = bulkCreateOptionsSchema.safeParse(options || {});
  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }
  if (!opts.success) {
    return { error: opts.error.errors[0]?.message || "Invalid import options" };
  }

  const selectedChildIds = opts.data.childIds;
  const schoolYearId = opts.data.schoolYearId;
  const hasCompleted = data.data.some((lesson) => lesson.status === "completed");
  if (hasCompleted && !schoolYearId) {
    return { error: "School year is required when importing completed lessons" };
  }
  if (hasCompleted && selectedChildIds.length === 0) {
    return { error: "At least one child is required when importing completed lessons" };
  }

  const client = await pool.connect();
  let created = 0;
  let createdIds: string[] = [];

  try {
    await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");

    let parentUserId: string | null = null;
    if (hasCompleted) {
      const userRes = await client.query("SELECT id FROM users WHERE role = 'parent' LIMIT 1");
      parentUserId = userRes.rows[0]?.id || null;
      if (!parentUserId) {
        throw new Error("No parent user found for completion records");
      }
    }

    if (schoolYearId && selectedChildIds.length > 0) {
      for (const childId of selectedChildIds) {
        await client.query(
          `INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (curriculum_id, child_id, school_year_id) DO NOTHING`,
          [data.data[0].curriculum_id, childId, schoolYearId]
        );
      }
    }

    let schoolYearEnd: string | null = null;
    if (schoolYearId) {
      const yearRes = await client.query(
        `SELECT end_date::text AS end_date FROM school_years WHERE id = $1`,
        [schoolYearId]
      );
      schoolYearEnd = yearRes.rows[0]?.end_date || null;
    }

    createdIds = [];
    for (let i = 0; i < data.data.length; i++) {
      const lesson = data.data[i];
      const createdLesson = await client.query(
        `INSERT INTO lessons (title, curriculum_id, planned_date, description, status, order_index, section)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          lesson.title,
          lesson.curriculum_id,
          lesson.planned_date || null,
          lesson.description || null,
          lesson.status || "planned",
          i,
          lesson.section || null,
        ]
      );

      createdIds.push(createdLesson.rows[0].id);

      if (lesson.status === "completed" && parentUserId && selectedChildIds.length > 0) {
        const completedAt = lesson.completed_date || schoolYearEnd || lesson.planned_date || undefined;
        for (const childId of selectedChildIds) {
          await client.query(
            `INSERT INTO lesson_completions (lesson_id, child_id, completed_by_user_id, completed_at, pass_fail)
             VALUES ($1, $2, $3, COALESCE($4::date::timestamptz, now()), $5)
             ON CONFLICT (lesson_id, child_id) DO UPDATE
               SET completed_at = COALESCE($4::date::timestamptz, lesson_completions.completed_at),
                   pass_fail = $5`,
            [
              createdLesson.rows[0].id,
              childId,
              parentUserId,
              completedAt || null,
              lesson.pass_fail || "pass",
            ]
          );
        }
      }

      created++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to create lessons in bulk", {
      error: err instanceof Error ? err.message : String(err),
      lessonCount: data.data.length,
      selectedChildCount: selectedChildIds.length,
      schoolYearId: schoolYearId || null,
    });
    return { error: "Failed to create lessons" };
  } finally {
    client.release();
  }

  revalidateAll();
  return { success: true, created, lessonIds: createdIds };
}

const updateLessonSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  curriculum_id: z.string().uuid(),
  planned_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")),
  description: z.string().optional(),
  grade_weight: z.coerce.number().min(0.1).max(10).default(1.0),
});

export async function updateLesson(formData: FormData) {
  const data = updateLessonSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    curriculum_id: formData.get("curriculum_id"),
    planned_date: formData.get("planned_date") || undefined,
    description: formData.get("description") || undefined,
    grade_weight: formData.get("grade_weight") || 1.0,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, title, curriculum_id, planned_date, description, grade_weight } = data.data;

  try {
    await pool.query(
      `UPDATE lessons SET title = $1, curriculum_id = $2, planned_date = $3, description = $4, grade_weight = $5
       WHERE id = $6`,
      [title, curriculum_id, planned_date || null, description || null, grade_weight, id]
    );
  } catch (err) {
    console.error("Failed to update lesson", { id, error: err instanceof Error ? err.message : String(err) });
    return { error: "Failed to update lesson" };
  }

  const rawTags = formData.get("tags");
  if (typeof rawTags === "string") {
    const { parseTagNames } = await import("@/lib/utils/resource-tags");
    const tagNames = parseTagNames(rawTags || undefined);
    await pool.query("DELETE FROM lesson_tags WHERE lesson_id = $1", [id]);
    for (const tagName of tagNames) {
      const tagRes = await pool.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [tagName]
      );
      await pool.query(
        `INSERT INTO lesson_tags (lesson_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, tagRes.rows[0].id]
      );
    }
  }

  revalidateAll();
  return { success: true };
}

export async function toggleChecklistItem(
  lessonId: string,
  itemIndex: number,
  checked: boolean,
) {
  const parsed = z.object({
    lessonId: z.string().uuid(),
    itemIndex: z.number().int().min(0),
    checked: z.boolean(),
  }).safeParse({ lessonId, itemIndex, checked });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    if (parsed.data.checked) {
      await pool.query(
        `UPDATE lessons SET checklist_state = checklist_state || jsonb_build_object($2::text, true) WHERE id = $1`,
        [parsed.data.lessonId, String(parsed.data.itemIndex)]
      );
    } else {
      await pool.query(
        `UPDATE lessons SET checklist_state = checklist_state - $2 WHERE id = $1`,
        [parsed.data.lessonId, String(parsed.data.itemIndex)]
      );
    }
  } catch (err) {
    console.error("Failed to toggle checklist item", {
      lessonId: parsed.data.lessonId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to update checklist" };
  }

  revalidatePath("/curricula");
  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteLesson(lessonId: string) {
  const parsed = z.string().uuid().safeParse(lessonId);
  if (!parsed.success) return { error: "Invalid lesson ID" };

  const user = await getCurrentUser();
  if (user.role !== "parent") return { error: "Not authorized to delete lessons" };

  try {
    await pool.query("DELETE FROM lessons WHERE id = $1", [parsed.data]);
  } catch (err) {
    console.error("Failed to delete lesson", { lessonId: parsed.data, error: err instanceof Error ? err.message : String(err) });
    return { error: "Failed to delete lesson" };
  }

  revalidateAll();
  return { success: true };
}

export async function bulkDeleteLessons(lessonIds: string[]) {
  const parsed = z.array(z.string().uuid()).min(1).max(500).safeParse(lessonIds);
  if (!parsed.success) return { error: "Invalid lesson IDs" };

  try {
    await pool.query(
      `DELETE FROM lessons WHERE id = ANY($1::uuid[])`,
      [parsed.data]
    );
  } catch (err) {
    console.error("Failed to bulk delete lessons", { count: parsed.data.length, error: err instanceof Error ? err.message : String(err) });
    return { error: "Failed to delete lessons" };
  }

  revalidateAll();
  return { success: true, deleted: parsed.data.length };
}

const createSubjectSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
});

export async function createSubject(formData: FormData) {
  const data = createSubjectSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { name, color } = data.data;

  const uploadedThumbnail = formData.get("thumbnail_file");
  const savedThumbnail = await saveUploadedImage(
    uploadedThumbnail instanceof File ? uploadedThumbnail : null,
    "subjects"
  );
  if (savedThumbnail && "error" in savedThumbnail) return savedThumbnail;

  const res = await pool.query(
    `INSERT INTO subjects (name, color, thumbnail_url)
     VALUES ($1, $2, $3) RETURNING id`,
    [name, color || null, savedThumbnail?.path || null]
  );

  revalidateAll();
  return { success: true, id: res.rows[0].id };
}

const SUBJECT_TEMPLATES: Record<string, { name: string; subjects: { name: string; color: string }[] }> = {
  classical: {
    name: "Classical",
    subjects: [
      { name: "Latin", color: "#8B5CF6" },
      { name: "Logic", color: "#6366F1" },
      { name: "Rhetoric", color: "#4F46E5" },
      { name: "Grammar", color: "#7C3AED" },
      { name: "Mathematics", color: "#2563EB" },
      { name: "History", color: "#B45309" },
      { name: "Science", color: "#059669" },
      { name: "Theology", color: "#9333EA" },
    ],
  },
  charlotte_mason: {
    name: "Charlotte Mason",
    subjects: [
      { name: "Living Books", color: "#7C3AED" },
      { name: "Nature Study", color: "#059669" },
      { name: "Narration", color: "#2563EB" },
      { name: "Copywork", color: "#B45309" },
      { name: "Handicrafts", color: "#DC2626" },
      { name: "Picture Study", color: "#DB2777" },
      { name: "Music Appreciation", color: "#9333EA" },
      { name: "Mathematics", color: "#0891B2" },
    ],
  },
  traditional: {
    name: "Traditional",
    subjects: [
      { name: "Math", color: "#2563EB" },
      { name: "Science", color: "#059669" },
      { name: "English/Language Arts", color: "#7C3AED" },
      { name: "History/Social Studies", color: "#B45309" },
      { name: "Reading", color: "#DC2626" },
      { name: "Writing", color: "#0891B2" },
      { name: "Art", color: "#DB2777" },
      { name: "Music", color: "#9333EA" },
      { name: "Physical Education", color: "#F59E0B" },
    ],
  },
};

const applyTemplateSchema = z.object({
  templateKey: z.string().min(1, "Template key is required"),
});

export async function applySubjectTemplate(templateKey: string) {
  const data = applyTemplateSchema.safeParse({ templateKey });
  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const template = SUBJECT_TEMPLATES[data.data.templateKey];
  if (!template) {
    return { error: "Unknown template" };
  }

  // Get existing subject names to skip duplicates
  const existing = await pool.query(`SELECT LOWER(name) AS name FROM subjects`);
  const existingNames = new Set(existing.rows.map((r: { name: string }) => r.name));

  const toCreate = template.subjects.filter(
    (s) => !existingNames.has(s.name.toLowerCase())
  );

  if (toCreate.length === 0) {
    return { success: true, created: 0, skipped: template.subjects.length };
  }

  for (const s of toCreate) {
    await pool.query(
      `INSERT INTO subjects (name, color) VALUES ($1, $2)`,
      [s.name, s.color]
    );
  }

  revalidateAll();
  return {
    success: true,
    created: toCreate.length,
    skipped: template.subjects.length - toCreate.length,
  };
}

const createCurriculumSchema = z.object({
  name: z.string().min(1, "Name is required"),
  subject_id: z.string().uuid().optional(),
  description: z.string().optional(),
  course_type: z.enum(["curriculum", "unit_study"]).optional(),
  grade_type: z.enum(["numeric", "pass_fail", "combo"]).optional(),
  status: z.enum(["active", "archived", "draft"]).optional(),
  start_date: optionalDateSchema,
  end_date: optionalDateSchema,
  notes: z.string().optional(),
  prepped: z.enum(["true", "false"]).optional(),
  default_view: z.enum(["board", "list"]).optional(),
  default_filter: z.enum(["all", "incomplete", "completed"]).optional(),
  child_id: z.string().uuid().optional(),
  school_year_id: z.string().uuid().optional(),
});

export async function createCurriculum(formData: FormData) {
  const data = createCurriculumSchema.safeParse({
    name: formData.get("name"),
    subject_id: formData.get("subject_id"),
    description: formData.get("description") || undefined,
    course_type: formData.get("course_type") || undefined,
    grade_type: formData.get("grade_type") || undefined,
    status: formData.get("status") || undefined,
    start_date: formData.get("start_date") || undefined,
    end_date: formData.get("end_date") || undefined,
    notes: formData.get("notes") || undefined,
    prepped: formData.get("prepped") || undefined,
    default_view: formData.get("default_view") || undefined,
    default_filter: formData.get("default_filter") || undefined,
    child_id: formData.get("child_id") || undefined,
    school_year_id: formData.get("school_year_id") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const {
    name,
    subject_id,
    description,
    course_type,
    grade_type,
    status,
    start_date,
    end_date,
    notes,
    prepped,
    default_view,
    default_filter,
    child_id,
    school_year_id,
  } = data.data;

  const uploadedCover = formData.get("cover_image_file");
  const savedCover = await saveUploadedImage(
    uploadedCover instanceof File ? uploadedCover : null,
    "curricula"
  );
  if (savedCover && "error" in savedCover) return savedCover;

  const res = await pool.query(
    `INSERT INTO curricula (name, subject_id, description, cover_image, course_type, grade_type, status, start_date, end_date, notes, prepped, default_view, default_filter)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
    [
      name,
      subject_id || null,
      description || null,
      savedCover?.path || null,
      course_type || "curriculum",
      grade_type || "numeric",
      status || "active",
      start_date || null,
      end_date || null,
      notes || null,
      prepped === "true",
      default_view || "board",
      default_filter || "all",
    ]
  );

  const curriculumId = res.rows[0].id;

  // If child_id and school_year_id provided, create the assignment
  if (child_id && school_year_id) {
    await pool.query(
      `INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id)
       VALUES ($1, $2, $3)`,
      [curriculumId, child_id, school_year_id]
    );
  }

  revalidateAll();
  return { success: true, id: curriculumId };
}

const assignCurriculumSchema = z.object({
  curriculum_id: z.string().uuid(),
  child_id: z.string().uuid(),
  school_year_id: z.string().uuid(),
});

export async function assignCurriculum(formData: FormData) {
  const data = assignCurriculumSchema.safeParse({
    curriculum_id: formData.get("curriculum_id"),
    child_id: formData.get("child_id"),
    school_year_id: formData.get("school_year_id"),
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { curriculum_id, child_id, school_year_id } = data.data;

  await pool.query(
    `INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (curriculum_id, child_id, school_year_id) DO NOTHING`,
    [curriculum_id, child_id, school_year_id]
  );

  revalidateAll();
  return { success: true };
}

export async function unassignCurriculum(curriculumId: string, childId: string) {
  const parsedCu = z.string().uuid().safeParse(curriculumId);
  const parsedCh = z.string().uuid().safeParse(childId);
  if (!parsedCu.success || !parsedCh.success) return { error: "Invalid input" };

  await pool.query(
    `DELETE FROM curriculum_assignments WHERE curriculum_id = $1 AND child_id = $2`,
    [parsedCu.data, parsedCh.data]
  );

  revalidateAll();
  return { success: true };
}

const updateSubjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  color: z.string().optional(),
  thumbnail_url: z.string().optional(),
});

export async function updateSubject(formData: FormData) {
  const data = updateSubjectSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    color: formData.get("color") || undefined,
    thumbnail_url: formData.get("thumbnail_url") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, name, color, thumbnail_url } = data.data;

  const uploadedThumbnail = formData.get("thumbnail_file");
  const savedThumbnail = await saveUploadedImage(
    uploadedThumbnail instanceof File ? uploadedThumbnail : null,
    "subjects"
  );
  if (savedThumbnail && "error" in savedThumbnail) return savedThumbnail;

  const clearThumbnail = formData.get("clear_thumbnail") === "true";
  const nextThumbnailUrl = clearThumbnail
    ? null
    : savedThumbnail?.path || thumbnail_url || null;

  await pool.query(
    `UPDATE subjects SET name = $1, color = $2, thumbnail_url = $3 WHERE id = $4`,
    [name, color || null, nextThumbnailUrl, id]
  );

  revalidateAll();
  return { success: true, thumbnail_url: nextThumbnailUrl };
}

export async function deleteSubject(subjectId: string) {
  const parsed = z.string().uuid().safeParse(subjectId);
  if (!parsed.success) return { error: "Invalid subject ID" };

  await pool.query("DELETE FROM subjects WHERE id = $1", [parsed.data]);

  revalidateAll();
  return { success: true };
}

const updateCurriculumSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  subject_id: z.string().uuid().optional(),
  course_type: z.enum(["curriculum", "unit_study"]).optional(),
  grade_type: z.enum(["numeric", "pass_fail", "combo"]).optional(),
  status: z.enum(["active", "archived", "draft"]).optional(),
  start_date: optionalDateSchema,
  end_date: optionalDateSchema,
  notes: z.string().optional(),
  prepped: z.enum(["true", "false"]).optional(),
  default_view: z.enum(["board", "list"]).optional(),
  default_filter: z.enum(["all", "incomplete", "completed"]).optional(),
  cover_image: z.string().optional(),
});

export async function updateCurriculum(formData: FormData) {
  const data = updateCurriculumSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    subject_id: formData.get("subject_id") || undefined,
    course_type: formData.get("course_type") || undefined,
    grade_type: formData.get("grade_type") || undefined,
    status: formData.get("status") || undefined,
    start_date: formData.get("start_date") || undefined,
    end_date: formData.get("end_date") || undefined,
    notes: formData.get("notes") || undefined,
    prepped: formData.get("prepped") || undefined,
    default_view: formData.get("default_view") || undefined,
    default_filter: formData.get("default_filter") || undefined,
    cover_image: formData.get("cover_image") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, name, description, subject_id, course_type, grade_type, status, start_date, end_date, notes, prepped, default_view, default_filter, cover_image } = data.data;

  const existingRes = await pool.query(
    `SELECT cover_image, course_type, grade_type, status, start_date::text, end_date::text, notes, prepped, default_view, default_filter
     FROM curricula WHERE id = $1`,
    [id]
  );
  if (!existingRes.rows[0]) {
    return { error: "Curriculum not found" };
  }
  const existing = existingRes.rows[0] as {
    cover_image: string | null;
    course_type: "curriculum" | "unit_study" | null;
    grade_type: "numeric" | "pass_fail" | null;
    status: "active" | "archived" | "draft" | null;
    start_date: string | null;
    end_date: string | null;
    notes: string | null;
    prepped: boolean;
    default_view: string;
    default_filter: string;
  };

  const uploadedCover = formData.get("cover_image_file");
  const savedCover = await saveUploadedImage(
    uploadedCover instanceof File ? uploadedCover : null,
    "curricula"
  );
  if (savedCover && "error" in savedCover) return savedCover;

  const clearCoverImage = formData.get("clear_cover_image") === "true";
  const nextCoverImage = clearCoverImage
    ? null
    : savedCover?.path || cover_image || existing.cover_image || null;
  const nextCourseType = course_type || existing.course_type || "curriculum";
  const nextGradeType = grade_type || existing.grade_type || "numeric";
  const nextStatus = status || existing.status || "active";
  const nextStartDate = start_date || existing.start_date || null;
  const nextEndDate = end_date || existing.end_date || null;
  const nextNotes = notes || existing.notes || null;
  const nextPrepped = prepped !== undefined ? prepped === "true" : existing.prepped;
  const nextDefaultView = default_view || existing.default_view || "board";
  const nextDefaultFilter = default_filter || existing.default_filter || "all";

  if (subject_id) {
    await pool.query(
        `UPDATE curricula
        SET name = $1, description = $2, subject_id = $3, cover_image = $4,
            course_type = $5, grade_type = $6, status = $7, start_date = $8, end_date = $9,
            notes = $10, prepped = $11, default_view = $12, default_filter = $13
       WHERE id = $14`,
      [
        name,
        description || null,
        subject_id,
        nextCoverImage,
        nextCourseType,
        nextGradeType,
        nextStatus,
        nextStartDate,
        nextEndDate,
        nextNotes,
        nextPrepped,
        nextDefaultView,
        nextDefaultFilter,
        id,
      ]
    );
  } else {
    await pool.query(
        `UPDATE curricula
       SET name = $1, description = $2, cover_image = $3,
            course_type = $4, grade_type = $5, status = $6, start_date = $7, end_date = $8,
            notes = $9, prepped = $10, default_view = $11, default_filter = $12
       WHERE id = $13`,
      [
        name,
        description || null,
        nextCoverImage,
        nextCourseType,
        nextGradeType,
        nextStatus,
        nextStartDate,
        nextEndDate,
        nextNotes,
        nextPrepped,
        nextDefaultView,
        nextDefaultFilter,
        id,
      ]
    );
  }

  // Sync curriculum tags if provided
  const rawTags = formData.get("tags");
  if (typeof rawTags === "string") {
    const { parseTagNames } = await import("@/lib/utils/resource-tags");
    const tagNames = parseTagNames(rawTags || undefined);
    await pool.query("DELETE FROM curriculum_tags WHERE curriculum_id = $1", [id]);
    for (const tagName of tagNames) {
      const tagRes = await pool.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [tagName]
      );
      await pool.query(
        `INSERT INTO curriculum_tags (curriculum_id, tag_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [id, tagRes.rows[0].id]
      );
    }
  }

  // Sync curriculum_subjects junction table
  const rawSecondarySubjects = formData.get("secondary_subject_ids");
  if (typeof rawSecondarySubjects === "string") {
    const secondaryIds = rawSecondarySubjects
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    // Remove all non-primary entries and re-insert
    await pool.query(
      "DELETE FROM curriculum_subjects WHERE curriculum_id = $1 AND is_primary = false",
      [id]
    );

    // Ensure primary subject is in the junction table
    const primarySubjectId = subject_id || (await pool.query(
      "SELECT subject_id FROM curricula WHERE id = $1", [id]
    )).rows[0]?.subject_id;

    if (primarySubjectId) {
      await pool.query(
        `INSERT INTO curriculum_subjects (curriculum_id, subject_id, is_primary)
         VALUES ($1, $2, true) ON CONFLICT (curriculum_id, subject_id) DO UPDATE SET is_primary = true`,
        [id, primarySubjectId]
      );
    }

    // Insert secondary subjects
    for (const secId of secondaryIds) {
      // Validate UUID format
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(secId)) continue;
      await pool.query(
        `INSERT INTO curriculum_subjects (curriculum_id, subject_id, is_primary)
         VALUES ($1, $2, false) ON CONFLICT (curriculum_id, subject_id) DO UPDATE SET is_primary = false`,
        [id, secId]
      );
    }
  }

  revalidateAll();
  return { success: true };
}

export async function reorderLessons(
  updates: { id: string; order_index: number; section: string | null }[]
) {
  const parsed = z
    .array(
      z.object({
        id: z.string().uuid(),
        order_index: z.number().int().min(0),
        section: z.string().nullable(),
      })
    )
    .min(1)
    .max(2000)
    .safeParse(updates);

  if (!parsed.success) {
    return { error: "Invalid input" };
  }

  const ids = parsed.data.map((u) => u.id);
  const orderIndexes = parsed.data.map((u) => u.order_index);
  const sections = parsed.data.map((u) => u.section);

  try {
    await pool.query(
      `UPDATE lessons SET order_index = u.order_index, section = u.section
       FROM (SELECT unnest($1::uuid[]) AS id, unnest($2::int[]) AS order_index, unnest($3::text[]) AS section) u
       WHERE lessons.id = u.id`,
      [ids, orderIndexes, sections]
    );
  } catch (err) {
    console.error("Failed to reorder lessons", {
      count: ids.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to reorder lessons" };
  }

  revalidatePath("/curricula");
  return { success: true };
}

export async function deleteCurriculum(curriculumId: string, force = false) {
  const parsed = z.string().uuid().safeParse(curriculumId);
  if (!parsed.success) return { error: "Invalid curriculum ID" };

  const user = await getCurrentUser();
  if (user.role !== "parent") return { error: "Not authorized to delete curricula" };

  // Check for completed lessons before deleting
  const statsRes = await pool.query(
    `SELECT
       COUNT(*)::int AS lesson_count,
       COUNT(DISTINCT lc.id)::int AS completed_count
     FROM lessons l
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id
     WHERE l.curriculum_id = $1`,
    [parsed.data]
  );
  const { lesson_count, completed_count } = statsRes.rows[0] as { lesson_count: number; completed_count: number };

  if (completed_count > 0 && !force) {
    return { confirm: true, lessonCount: lesson_count, completedCount: completed_count };
  }

  await pool.query("DELETE FROM curricula WHERE id = $1", [parsed.data]);

  revalidateAll();
  return { success: true };
}

/* ------------------------------------------------------------------ */
/*  Lesson Archiving                                                  */
/* ------------------------------------------------------------------ */

const archiveSchema = z.object({
  yearId: z.string().uuid().optional(),
});

/**
 * Archive all completed lessons, optionally scoped to a school year.
 * Sets archived = true for lessons with status = 'completed'.
 */
export async function archiveCompletedLessons(formData: FormData) {
  const yearId = formData.get("yearId") as string | null;
  const parsed = archiveSchema.safeParse({
    yearId: yearId || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    let result;
    if (parsed.data.yearId) {
      result = await pool.query(
        `UPDATE lessons SET archived = true
         WHERE status = 'completed'
           AND archived = false
           AND curriculum_id IN (
             SELECT ca.curriculum_id
             FROM curriculum_assignments ca
             WHERE ca.school_year_id = $1
           )`,
        [parsed.data.yearId]
      );
    } else {
      result = await pool.query(
        `UPDATE lessons SET archived = true
         WHERE status = 'completed'
           AND archived = false`
      );
    }

    revalidateAll();
    return { success: true, archivedCount: result.rowCount ?? 0 };
  } catch (err) {
    console.error("Failed to archive lessons", err instanceof Error ? err.message : String(err));
    return { error: "Failed to archive lessons" };
  }
}

const unarchiveSchema = z.object({
  curriculumId: z.string().uuid().optional(),
  yearId: z.string().uuid().optional(),
});

/**
 * Unarchive lessons scoped by curriculum or school year.
 * Sets archived = false.
 */
export async function unarchiveLessons(formData: FormData) {
  const curriculumId = formData.get("curriculumId") as string | null;
  const yearId = formData.get("yearId") as string | null;
  const parsed = unarchiveSchema.safeParse({
    curriculumId: curriculumId || undefined,
    yearId: yearId || undefined,
  });
  if (!parsed.success) return { error: "Invalid input" };
  if (!parsed.data.curriculumId && !parsed.data.yearId) {
    return { error: "Must provide curriculumId or yearId" };
  }

  try {
    if (parsed.data.curriculumId) {
      await pool.query(
        `UPDATE lessons SET archived = false
         WHERE archived = true
           AND curriculum_id = $1`,
        [parsed.data.curriculumId]
      );
    } else if (parsed.data.yearId) {
      await pool.query(
        `UPDATE lessons SET archived = false
         WHERE archived = true
           AND curriculum_id IN (
             SELECT ca.curriculum_id
             FROM curriculum_assignments ca
             WHERE ca.school_year_id = $1
           )`,
        [parsed.data.yearId]
      );
    }

    revalidateAll();
    return { success: true };
  } catch (err) {
    console.error("Failed to unarchive lessons", err instanceof Error ? err.message : String(err));
    return { error: "Failed to unarchive lessons" };
  }
}

const importCurriculumSchema = z.object({
  json: z.string().min(1, "JSON is required"),
  subjectId: z.string().uuid("Invalid subject ID"),
});

export async function importCurriculum(formData: FormData) {
  const parsed = importCurriculumSchema.safeParse({
    json: formData.get("json"),
    subjectId: formData.get("subjectId"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  let data: {
    harmony_curriculum_export?: boolean;
    name?: string;
    description?: string | null;
    cover_image?: string | null;
    course_type?: string;
    grade_type?: string;
    lessons?: Array<{
      title: string;
      description?: string | null;
      order_index?: number;
      section?: string | null;
      estimated_duration?: number | null;
    }>;
    resources?: Array<{
      title: string;
      type: string;
      url: string;
      author?: string | null;
      description?: string | null;
    }>;
    curriculum_resources?: Array<{
      title: string;
      type: string;
      url: string;
      author?: string | null;
      description?: string | null;
    }>;
  };

  try {
    data = JSON.parse(parsed.data.json);
  } catch {
    return { error: "Invalid JSON format" };
  }

  if (!data.harmony_curriculum_export) {
    return { error: "Not a valid Harmony curriculum export file" };
  }

  if (!data.name) {
    return { error: "Curriculum name is required" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Create the curriculum
    const currRes = await client.query(
      `INSERT INTO curricula (name, description, cover_image, subject_id, course_type, grade_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING id`,
      [
        data.name,
        data.description || null,
        data.cover_image || null,
        parsed.data.subjectId,
        data.course_type || "curriculum",
        data.grade_type || "numeric",
      ]
    );
    const curriculumId = currRes.rows[0].id;

    // Create lessons
    if (data.lessons && data.lessons.length > 0) {
      for (const lesson of data.lessons) {
        await client.query(
          `INSERT INTO lessons (curriculum_id, title, description, order_index, section, estimated_duration, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'planned')`,
          [
            curriculumId,
            lesson.title,
            lesson.description || null,
            lesson.order_index ?? 0,
            lesson.section || null,
            lesson.estimated_duration || null,
          ]
        );
      }
    }

    // Create global resources and link them to the curriculum
    const allResources = [
      ...(data.resources || []),
      ...(data.curriculum_resources || []),
    ];

    for (const resource of allResources) {
      if (!resource.url) continue;

      // Check if a resource with this URL already exists
      const existingRes = await client.query(
        `SELECT id FROM resources WHERE url = $1 LIMIT 1`,
        [resource.url]
      );

      let resourceId: string;
      if (existingRes.rows.length > 0) {
        resourceId = existingRes.rows[0].id;
      } else {
        const newRes = await client.query(
          `INSERT INTO resources (title, type, url, author, description)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [
            resource.title || resource.url,
            resource.type || "link",
            resource.url,
            resource.author || null,
            resource.description || null,
          ]
        );
        resourceId = newRes.rows[0].id;
      }

      // Link resource to curriculum
      await client.query(
        `INSERT INTO curriculum_resources (curriculum_id, resource_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [curriculumId, resourceId]
      );
    }

    await client.query("COMMIT");
    revalidateAll();
    return { success: true, curriculumId };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to import curriculum", err instanceof Error ? err.message : String(err));
    return { error: "Failed to import curriculum" };
  } finally {
    client.release();
  }
}

const reassignSchema = z.object({
  lessonId: z.string().uuid("Invalid lesson ID"),
  newChildId: z.string().uuid("Invalid child ID"),
});

export async function reassignLessonToChild(lessonId: string, newChildId: string) {
  const parsed = reassignSchema.safeParse({ lessonId, newChildId });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find the lesson's curriculum and current assignment
    const lessonRes = await client.query(
      `SELECT l.curriculum_id, ca.id AS assignment_id, ca.child_id, ca.school_year_id
       FROM lessons l
       JOIN curriculum_assignments ca ON ca.curriculum_id = l.curriculum_id
       WHERE l.id = $1
       LIMIT 1`,
      [parsed.data.lessonId]
    );

    if (lessonRes.rows.length === 0) {
      await client.query("ROLLBACK");
      return { error: "Lesson or assignment not found" };
    }

    const { curriculum_id, child_id: currentChildId, school_year_id } = lessonRes.rows[0];

    if (currentChildId === parsed.data.newChildId) {
      await client.query("ROLLBACK");
      return { error: "Lesson is already assigned to this child" };
    }

    // Check if the new child already has an assignment for this curriculum
    const existingAssignment = await client.query(
      `SELECT id FROM curriculum_assignments
       WHERE curriculum_id = $1 AND child_id = $2`,
      [curriculum_id, parsed.data.newChildId]
    );

    if (existingAssignment.rows.length === 0) {
      // Create a new assignment for the new child
      await client.query(
        `INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id)
         VALUES ($1, $2, $3)`,
        [curriculum_id, parsed.data.newChildId, school_year_id]
      );
    }

    // Move any existing completions for this lesson from old child to new child
    await client.query(
      `UPDATE lesson_completions
       SET child_id = $1
       WHERE lesson_id = $2 AND child_id = $3`,
      [parsed.data.newChildId, parsed.data.lessonId, currentChildId]
    );

    await client.query("COMMIT");
    revalidateAll();
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to reassign lesson", err instanceof Error ? err.message : String(err));
    return { error: "Failed to reassign lesson" };
  } finally {
    client.release();
  }
}
