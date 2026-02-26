"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";
import { completionValuePayload } from "@/lib/utils/completion-values";
import { shiftLessonsAfterCompletion } from "@/lib/actions/lessons";
import { getCurrentUser } from "@/lib/session";

const parsedGradeSchema = z
  .string()
  .regex(/^\d{1,3}(\.\d{1,2})?$/, {
    message: "Grade must be a number with up to 2 decimals",
  })
  .transform((value) => Number(value))
  .refine((value) => Number.isFinite(value), {
    message: "Grade must be a valid number",
  })
  .refine((value) => value >= 0 && value <= 100, {
    message: "Grade must be between 0 and 100",
  });

const optionalGradeSchema = z.preprocess((value) => {
  if (value == null) return undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  }
  return String(value);
}, parsedGradeSchema.optional());

const requiredGradeSchema = z.preprocess((value) => {
  if (value == null) return value;
  if (typeof value === "string") return value.trim();
  return String(value);
}, parsedGradeSchema);

const completeSchema = z.object({
  lessonId: z.string().uuid(),
  childId: z.string().uuid(),
  gradeType: z.enum(["numeric", "pass_fail", "combo"]).optional().default("numeric"),
  grade: optionalGradeSchema,
  passFail: z.enum(["pass", "fail"]).optional(),
  notes: z.string().optional(),
});

export async function markLessonComplete(formData: FormData) {
  const data = completeSchema.safeParse({
    lessonId: formData.get("lessonId"),
    childId: formData.get("childId"),
    gradeType: formData.get("gradeType") || undefined,
    grade: formData.get("grade"),
    passFail: formData.get("passFail") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!data.success) {
    return { error: data.error.issues[0]?.message || "Invalid input" };
  }

  const { lessonId, childId, gradeType, grade, passFail, notes } = data.data;

  const currentUser = await getCurrentUser();

  // If user has mark_complete permission (not full), insert into pending queue
  if (currentUser.permissionLevel === "mark_complete") {
    const payload = completionValuePayload({
      gradeType,
      grade,
      passFail,
      notes,
    });

    try {
      await pool.query(
        `INSERT INTO pending_completions (lesson_id, child_id, submitted_by, notes, grade)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lesson_id, child_id) DO UPDATE
           SET notes = $4, grade = $5, submitted_by = $3, created_at = now()`,
        [
          lessonId,
          childId,
          currentUser.id || null,
          payload.notes ?? null,
          payload.grade ?? null,
        ]
      );
    } catch (err) {
      console.error("Failed to submit pending completion", {
        lessonId,
        childId,
        error: err instanceof Error ? err.message : String(err),
      });
      return { error: "Failed to submit completion for approval" };
    }

    revalidatePath("/dashboard");
    return { success: true, pending: true };
  }

  // Full permission: create the completion directly (existing behavior)
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get the parent user for completed_by_user_id
    const userRes = await client.query(
      "SELECT id FROM users WHERE role = 'parent' LIMIT 1"
    );
    const userId = userRes.rows[0]?.id;
    if (!userId) {
      await client.query("ROLLBACK");
      return { error: "No parent user found" };
    }

    const payload = completionValuePayload({
      gradeType,
      grade,
      passFail,
      notes,
    });

    await client.query(
      `INSERT INTO lesson_completions (lesson_id, child_id, completed_by_user_id, grade, pass_fail, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (lesson_id, child_id) DO UPDATE
         SET grade = $4, pass_fail = $5, notes = $6, completed_at = now()`,
      [
        lessonId,
        childId,
        userId,
        payload.grade,
        payload.passFail,
        payload.notes,
      ]
    );

    await client.query("UPDATE lessons SET status = 'completed' WHERE id = $1", [
      lessonId,
    ]);

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to mark lesson complete", {
      lessonId,
      childId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to mark lesson complete" };
  } finally {
    client.release();
  }

  // Auto-set actual start/end dates on curriculum
  try {
    const currRes = await pool.query(
      `SELECT curriculum_id FROM lessons WHERE id = $1`, [lessonId]
    );
    if (currRes.rows[0]?.curriculum_id) {
      const cid = currRes.rows[0].curriculum_id;
      // Set actual_start_date if not yet set
      await pool.query(
        `UPDATE curricula SET actual_start_date = CURRENT_DATE
         WHERE id = $1 AND actual_start_date IS NULL`, [cid]
      );
      // Set actual_end_date if all lessons are completed
      await pool.query(
        `UPDATE curricula SET actual_end_date = CURRENT_DATE
         WHERE id = $1
           AND NOT EXISTS (
             SELECT 1 FROM lessons WHERE curriculum_id = $1 AND status != 'completed'
           )`, [cid]
      );
    }
  } catch { /* non-critical */ }

  // Shift remaining lessons in the curriculum to fill the gap
  await shiftLessonsAfterCompletion(lessonId, childId);

  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/grades");
  revalidatePath("/dashboard");
  revalidatePath("/subjects");
  revalidatePath("/curricula");
  revalidatePath("/calendar");
  revalidatePath("/students");
  revalidatePath("/reports");
  return { success: true };
}

export async function markLessonIncomplete(lessonId: string, childId: string) {
  const parsed = z
    .object({ lessonId: z.string().uuid(), childId: z.string().uuid() })
    .safeParse({ lessonId, childId });
  if (!parsed.success) return { error: "Invalid input" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "DELETE FROM lesson_completions WHERE lesson_id = $1 AND child_id = $2",
      [parsed.data.lessonId, parsed.data.childId]
    );
    await client.query("UPDATE lessons SET status = 'planned' WHERE id = $1", [
      parsed.data.lessonId,
    ]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to mark lesson incomplete", {
      lessonId: parsed.data.lessonId,
      childId: parsed.data.childId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to mark lesson incomplete" };
  } finally {
    client.release();
  }

  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/grades");
  revalidatePath("/dashboard");
  revalidatePath("/subjects");
  revalidatePath("/curricula");
  revalidatePath("/calendar");
  revalidatePath("/students");
  revalidatePath("/reports");
  return { success: true };
}

const updateGradeSchema = z.object({
  completionId: z.string().uuid(),
  grade: requiredGradeSchema,
  notes: z.string().optional(),
});

export async function updateGrade(formData: FormData) {
  const data = updateGradeSchema.safeParse({
    completionId: formData.get("completionId"),
    grade: formData.get("grade"),
    notes: formData.get("notes") || undefined,
  });

  if (!data.success) {
    return { error: data.error.issues[0]?.message || "Invalid input" };
  }

  await pool.query(
    "UPDATE lesson_completions SET grade = $1, notes = $2 WHERE id = $3",
    [data.data.grade, data.data.notes ?? null, data.data.completionId]
  );

  revalidatePath("/grades");
  revalidatePath("/week");
  revalidatePath("/dashboard");
  revalidatePath("/lessons");
  revalidatePath("/subjects");
  revalidatePath("/curricula");
  revalidatePath("/calendar");
  revalidatePath("/students");
  revalidatePath("/reports");
  return { success: true };
}

// --- Pending completion approval workflow ---

const uuidSchema = z.string().uuid();

export async function getPendingCompletions() {
  const res = await pool.query(`
    SELECT pc.id, pc.lesson_id, pc.child_id, pc.notes, pc.grade, pc.created_at,
           l.title as lesson_title, l.section as lesson_section,
           c.name as child_name,
           u.name as submitted_by_name
    FROM pending_completions pc
    JOIN lessons l ON l.id = pc.lesson_id
    JOIN children c ON c.id = pc.child_id
    LEFT JOIN users u ON u.id = pc.submitted_by
    ORDER BY pc.created_at DESC
  `);
  return res.rows;
}

export async function getPendingCompletionCount() {
  const res = await pool.query(
    "SELECT COUNT(*) as count FROM pending_completions"
  );
  return parseInt(res.rows[0].count, 10);
}

export async function approvePendingCompletion(pendingId: string) {
  const parsed = uuidSchema.safeParse(pendingId);
  if (!parsed.success) return { error: "Invalid pending completion ID" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get the pending record
    const pendingRes = await client.query(
      "SELECT * FROM pending_completions WHERE id = $1",
      [parsed.data]
    );
    const pending = pendingRes.rows[0];
    if (!pending) {
      await client.query("ROLLBACK");
      return { error: "Pending completion not found" };
    }

    // Get the parent user for completed_by_user_id
    const userRes = await client.query(
      "SELECT id FROM users WHERE role = 'parent' LIMIT 1"
    );
    const userId = userRes.rows[0]?.id;
    if (!userId) {
      await client.query("ROLLBACK");
      return { error: "No parent user found" };
    }

    // Insert into lesson_completions
    await client.query(
      `INSERT INTO lesson_completions (lesson_id, child_id, completed_by_user_id, grade, notes)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (lesson_id, child_id) DO UPDATE
         SET grade = $4, notes = $5, completed_at = now()`,
      [pending.lesson_id, pending.child_id, userId, pending.grade, pending.notes]
    );

    // Mark lesson as completed
    await client.query(
      "UPDATE lessons SET status = 'completed' WHERE id = $1",
      [pending.lesson_id]
    );

    // Remove from pending
    await client.query("DELETE FROM pending_completions WHERE id = $1", [
      parsed.data,
    ]);

    await client.query("COMMIT");

    // Shift remaining lessons after approval
    await shiftLessonsAfterCompletion(pending.lesson_id, pending.child_id);
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to approve pending completion", {
      pendingId: parsed.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to approve completion" };
  } finally {
    client.release();
  }

  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/grades");
  revalidatePath("/dashboard");
  revalidatePath("/subjects");
  revalidatePath("/curricula");
  revalidatePath("/calendar");
  revalidatePath("/students");
  revalidatePath("/reports");
  revalidatePath("/approvals");
  return { success: true };
}

export async function rejectPendingCompletion(pendingId: string) {
  const parsed = uuidSchema.safeParse(pendingId);
  if (!parsed.success) return { error: "Invalid pending completion ID" };

  try {
    await pool.query("DELETE FROM pending_completions WHERE id = $1", [
      parsed.data,
    ]);
  } catch (err) {
    console.error("Failed to reject pending completion", {
      pendingId: parsed.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to reject completion" };
  }

  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/dashboard");
  revalidatePath("/curricula");
  revalidatePath("/approvals");
  return { success: true };
}

const copyCompletionsSchema = z.object({
  curriculumId: z.string().uuid(),
  sourceChildId: z.string().uuid(),
  targetChildId: z.string().uuid(),
});

export async function copyCompletionsToChild(
  curriculumId: string,
  sourceChildId: string,
  targetChildId: string
) {
  const data = copyCompletionsSchema.safeParse({
    curriculumId,
    sourceChildId,
    targetChildId,
  });
  if (!data.success) {
    return { error: data.error.issues[0]?.message || "Invalid input" };
  }

  const { curriculumId: cId, sourceChildId: sId, targetChildId: tId } = data.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const result = await client.query(
      `INSERT INTO lesson_completions (lesson_id, child_id, completed_by_user_id, completed_at, grade, pass_fail, notes)
       SELECT lc.lesson_id, $1, lc.completed_by_user_id, lc.completed_at, lc.grade, lc.pass_fail, lc.notes
       FROM lesson_completions lc
       JOIN lessons l ON l.id = lc.lesson_id
       WHERE lc.child_id = $2
         AND l.curriculum_id = $3
       ON CONFLICT (lesson_id, child_id) DO NOTHING`,
      [tId, sId, cId]
    );

    await client.query("COMMIT");

    revalidatePath("/curricula");
    revalidatePath("/lessons");
    revalidatePath("/grades");
    revalidatePath("/dashboard");
    revalidatePath("/students");
    revalidatePath("/reports");
    revalidatePath("/week");
    revalidatePath("/calendar");

    return { success: true, copied: result.rowCount || 0 };
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to copy completions", {
      curriculumId: cId,
      sourceChildId: sId,
      targetChildId: tId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to copy completions" };
  } finally {
    client.release();
  }
}
