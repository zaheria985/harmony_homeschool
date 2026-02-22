"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";
import { completionValuePayload } from "@/lib/utils/completion-values";
import { shiftLessonsAfterCompletion } from "@/lib/actions/lessons";

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
  gradeType: z.enum(["numeric", "pass_fail"]).optional().default("numeric"),
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
