"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";

// ============================================================================
// INLINE LESSON RESOURCES (legacy)
// ============================================================================

const addLessonResourceSchema = z.object({
  lesson_id: z.string().uuid(),
  type: z.enum(["youtube", "pdf", "filerun", "url"]),
  url: z.string().url("Must be a valid URL"),
  title: z.string().optional(),
});

export async function addResource(formData: FormData) {
  const data = addLessonResourceSchema.safeParse({
    lesson_id: formData.get("lesson_id"),
    type: formData.get("type"),
    url: formData.get("url"),
    title: formData.get("title") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { lesson_id, type, url, title } = data.data;

  await pool.query(
    `INSERT INTO lesson_resources (lesson_id, type, url, title)
     VALUES ($1, $2, $3, $4)`,
    [lesson_id, type, url, title || null]
  );

  revalidatePath("/lessons");
  revalidatePath("/calendar");
  return { success: true };
}

export async function deleteLessonResource(resourceId: string) {
  const parsed = z.string().uuid().safeParse(resourceId);
  if (!parsed.success) return { error: "Invalid resource ID" };

  await pool.query("DELETE FROM lesson_resources WHERE id = $1", [parsed.data]);

  revalidatePath("/lessons");
  revalidatePath("/calendar");
  return { success: true };
}

// Keep old name as alias for backwards compatibility
export { deleteLessonResource as deleteResource };

// ============================================================================
// GLOBAL RESOURCE LIBRARY
// ============================================================================

const resourceTypeSchema = z.enum(["book", "video", "pdf", "link", "supply"]);

const createGlobalResourceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: resourceTypeSchema,
  url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  description: z.string().optional(),
});

export async function createGlobalResource(formData: FormData) {
  const data = createGlobalResourceSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    url: formData.get("url") || undefined,
    thumbnail_url: formData.get("thumbnail_url") || undefined,
    description: formData.get("description") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { title, type, url, thumbnail_url, description } = data.data;

  const res = await pool.query(
    `INSERT INTO resources (title, type, url, thumbnail_url, description)
     VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [title, type, url || null, thumbnail_url || null, description || null]
  );

  revalidatePath("/resources");
  return { success: true, id: res.rows[0].id };
}

const updateGlobalResourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  type: resourceTypeSchema,
  url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  description: z.string().optional(),
});

export async function updateGlobalResource(formData: FormData) {
  const data = updateGlobalResourceSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    type: formData.get("type"),
    url: formData.get("url") || undefined,
    thumbnail_url: formData.get("thumbnail_url") || undefined,
    description: formData.get("description") || undefined,
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, title, type, url, thumbnail_url, description } = data.data;

  await pool.query(
    `UPDATE resources SET title = $1, type = $2, url = $3, thumbnail_url = $4, description = $5
     WHERE id = $6`,
    [title, type, url || null, thumbnail_url || null, description || null, id]
  );

  revalidatePath("/resources");
  revalidatePath(`/resources/${id}`);
  return { success: true };
}

export async function deleteGlobalResource(resourceId: string) {
  const parsed = z.string().uuid().safeParse(resourceId);
  if (!parsed.success) return { error: "Invalid resource ID" };

  // Unlink from lessons first
  await pool.query(
    "UPDATE lesson_resources SET resource_id = NULL WHERE resource_id = $1",
    [parsed.data]
  );

  await pool.query("DELETE FROM resources WHERE id = $1", [parsed.data]);

  revalidatePath("/resources");
  revalidatePath("/lessons");
  return { success: true };
}

const attachSchema = z.object({
  resourceId: z.string().uuid(),
  lessonIds: z.array(z.string().uuid()).min(1, "Select at least one lesson"),
});

export async function attachResourceToLessons(
  resourceId: string,
  lessonIds: string[]
) {
  const data = attachSchema.safeParse({ resourceId, lessonIds });
  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { resourceId: rId, lessonIds: lIds } = data.data;

  const resource = await pool.query(
    "SELECT title, type, url FROM resources WHERE id = $1",
    [rId]
  );
  if (!resource.rows[0]) return { error: "Resource not found" };

  const r = resource.rows[0];
  // Map resource types to lesson_resources types
  const lrType = ["youtube", "pdf", "url"].includes(r.type) ? r.type : "url";

  for (const lessonId of lIds) {
    const existing = await pool.query(
      "SELECT id FROM lesson_resources WHERE lesson_id = $1 AND resource_id = $2",
      [lessonId, rId]
    );
    if (existing.rows.length === 0) {
      await pool.query(
        `INSERT INTO lesson_resources (lesson_id, resource_id, type, url, title)
         VALUES ($1, $2, $3, $4, $5)`,
        [lessonId, rId, lrType, r.url || "", r.title]
      );
    }
  }

  revalidatePath("/resources");
  revalidatePath(`/resources/${rId}`);
  revalidatePath("/lessons");
  return { success: true };
}

export async function detachResourceFromLesson(
  resourceId: string,
  lessonId: string
) {
  const parsedR = z.string().uuid().safeParse(resourceId);
  const parsedL = z.string().uuid().safeParse(lessonId);
  if (!parsedR.success || !parsedL.success) return { error: "Invalid input" };

  await pool.query(
    "DELETE FROM lesson_resources WHERE resource_id = $1 AND lesson_id = $2",
    [parsedR.data, parsedL.data]
  );

  revalidatePath("/resources");
  revalidatePath(`/resources/${parsedR.data}`);
  revalidatePath("/lessons");
  return { success: true };
}
