"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";

const completeSchema = z.object({
  lessonId: z.string().uuid(),
  childId: z.string().uuid(),
  grade: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export async function markLessonComplete(formData: FormData) {
  const data = completeSchema.safeParse({
    lessonId: formData.get("lessonId"),
    childId: formData.get("childId"),
    grade: formData.get("grade") ? Number(formData.get("grade")) : undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!data.success) {
    return { error: "Invalid input" };
  }

  const { lessonId, childId, grade, notes } = data.data;

  // Get the parent user for completed_by_user_id
  const userRes = await pool.query(
    "SELECT id FROM users WHERE role = 'parent' LIMIT 1"
  );
  const userId = userRes.rows[0]?.id;
  if (!userId) return { error: "No parent user found" };

  await pool.query(
    `INSERT INTO lesson_completions (lesson_id, child_id, completed_by_user_id, grade, notes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (lesson_id, child_id) DO UPDATE SET grade = $4, notes = $5, completed_at = now()`,
    [lessonId, childId, userId, grade ?? null, notes ?? null]
  );

  await pool.query("UPDATE lessons SET status = 'completed' WHERE id = $1", [
    lessonId,
  ]);

  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/grades");
  revalidatePath("/dashboard");
  return { success: true };
}

const updateGradeSchema = z.object({
  completionId: z.string().uuid(),
  grade: z.number().min(0).max(100),
  notes: z.string().optional(),
});

export async function updateGrade(formData: FormData) {
  const data = updateGradeSchema.safeParse({
    completionId: formData.get("completionId"),
    grade: Number(formData.get("grade")),
    notes: formData.get("notes") || undefined,
  });

  if (!data.success) {
    return { error: "Invalid input" };
  }

  await pool.query(
    "UPDATE lesson_completions SET grade = $1, notes = $2 WHERE id = $3",
    [data.data.grade, data.data.notes ?? null, data.data.completionId]
  );

  revalidatePath("/grades");
  revalidatePath("/week");
  revalidatePath("/dashboard");
  return { success: true };
}
