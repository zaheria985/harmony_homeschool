"use server";

import { z } from "zod";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

const templateLessonSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  order_index: z.number().int().min(0),
});

const saveTemplateSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, "Template name is required"),
  description: z.string().optional().default(""),
  lessons: z.array(templateLessonSchema).min(1, "At least one lesson is required"),
});

const applyTemplateSchema = z.object({
  templateId: z.string().uuid(),
  curriculumId: z.string().uuid(),
});

const saveAsTemplateSchema = z.object({
  curriculumId: z.string().uuid(),
  name: z.string().min(1, "Template name is required"),
});

/** Create or update a lesson template */
export async function saveLessonTemplate(formData: FormData) {
  const raw = {
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    description: formData.get("description") || "",
    lessons: JSON.parse((formData.get("lessons") as string) || "[]"),
  };

  const data = saveTemplateSchema.safeParse(raw);
  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, name, description, lessons } = data.data;

  try {
    if (id) {
      await pool.query(
        `UPDATE lesson_templates
         SET name = $1, description = $2, lessons = $3, updated_at = now()
         WHERE id = $4`,
        [name, description, JSON.stringify(lessons), id]
      );
    } else {
      await pool.query(
        `INSERT INTO lesson_templates (name, description, lessons)
         VALUES ($1, $2, $3)`,
        [name, description, JSON.stringify(lessons)]
      );
    }
  } catch (err) {
    console.error("Failed to save lesson template", err);
    return { error: "Failed to save template" };
  }

  revalidatePath("/curricula");
  return { success: true };
}

/** Delete a lesson template */
export async function deleteLessonTemplate(formData: FormData) {
  const id = formData.get("id");
  if (!id || typeof id !== "string") {
    return { error: "Template ID is required" };
  }

  try {
    await pool.query("DELETE FROM lesson_templates WHERE id = $1", [id]);
  } catch (err) {
    console.error("Failed to delete lesson template", err);
    return { error: "Failed to delete template" };
  }

  revalidatePath("/curricula");
  return { success: true };
}

/** Fetch all lesson templates */
export async function getLessonTemplates() {
  const res = await pool.query(
    `SELECT id, name, description, lessons, created_at, updated_at
     FROM lesson_templates
     ORDER BY updated_at DESC`
  );
  return res.rows as {
    id: string;
    name: string;
    description: string | null;
    lessons: { title: string; description: string; order_index: number }[];
    created_at: string;
    updated_at: string;
  }[];
}

/** Apply a template to a curriculum — creates lessons from the template */
export async function applyLessonTemplate(formData: FormData) {
  const raw = {
    templateId: formData.get("templateId"),
    curriculumId: formData.get("curriculumId"),
  };

  const data = applyTemplateSchema.safeParse(raw);
  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { templateId, curriculumId } = data.data;

  try {
    // Fetch the template
    const templateRes = await pool.query(
      "SELECT lessons FROM lesson_templates WHERE id = $1",
      [templateId]
    );
    if (templateRes.rows.length === 0) {
      return { error: "Template not found" };
    }

    const templateLessons = templateRes.rows[0].lessons as {
      title: string;
      description: string;
      order_index: number;
    }[];

    // Get the current max order_index for this curriculum
    const maxRes = await pool.query(
      "SELECT COALESCE(MAX(order_index), -1) AS max_idx FROM lessons WHERE curriculum_id = $1",
      [curriculumId]
    );
    const startIndex = (maxRes.rows[0].max_idx as number) + 1;

    // Insert all lessons
    for (const lesson of templateLessons) {
      await pool.query(
        `INSERT INTO lessons (curriculum_id, title, description, order_index)
         VALUES ($1, $2, $3, $4)`,
        [
          curriculumId,
          lesson.title,
          lesson.description || null,
          startIndex + lesson.order_index,
        ]
      );
    }
  } catch (err) {
    console.error("Failed to apply lesson template", err);
    return { error: "Failed to apply template" };
  }

  revalidatePath("/curricula");
  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Save current curriculum lessons as a new template */
export async function saveAsTemplate(formData: FormData) {
  const raw = {
    curriculumId: formData.get("curriculumId"),
    name: formData.get("name"),
  };

  const data = saveAsTemplateSchema.safeParse(raw);
  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { curriculumId, name } = data.data;

  try {
    // Fetch lessons from the curriculum
    const lessonsRes = await pool.query(
      `SELECT title, description, order_index
       FROM lessons
       WHERE curriculum_id = $1 AND archived = false
       ORDER BY order_index ASC`,
      [curriculumId]
    );

    if (lessonsRes.rows.length === 0) {
      return { error: "No lessons found in this curriculum" };
    }

    const lessons = lessonsRes.rows.map((r, i) => ({
      title: r.title,
      description: r.description || "",
      order_index: i,
    }));

    await pool.query(
      `INSERT INTO lesson_templates (name, lessons)
       VALUES ($1, $2)`,
      [name, JSON.stringify(lessons)]
    );
  } catch (err) {
    console.error("Failed to save as template", err);
    return { error: "Failed to save as template" };
  }

  revalidatePath("/curricula");
  return { success: true };
}
