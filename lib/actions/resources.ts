"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PoolClient } from "pg";
import pool from "@/lib/db";
import { saveUploadedImage } from "@/lib/server/uploads";
import { mergeTagNames, parseTagNames } from "@/lib/utils/resource-tags";

async function syncResourceTags(
  client: PoolClient,
  resourceId: string,
  rawTags: string | undefined
) {
  const tagNames = parseTagNames(rawTags);
  await client.query("DELETE FROM resource_tags WHERE resource_id = $1", [resourceId]);

  for (const tagName of tagNames) {
    const tagRes = await client.query(
      `INSERT INTO tags (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [tagName]
    );

    await client.query(
      `INSERT INTO resource_tags (resource_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (resource_id, tag_id) DO NOTHING`,
      [resourceId, tagRes.rows[0].id]
    );
  }
}

async function syncResourceBooklists(
  client: PoolClient,
  resourceId: string,
  booklistIds: string[]
) {
  await client.query("DELETE FROM booklist_resources WHERE resource_id = $1", [
    resourceId,
  ]);

  for (const booklistId of booklistIds) {
    await client.query(
      `INSERT INTO booklist_resources (booklist_id, resource_id)
       VALUES ($1, $2)
       ON CONFLICT (booklist_id, resource_id) DO NOTHING`,
      [booklistId, resourceId]
    );
  }
}

// ============================================================================
// INLINE LESSON RESOURCES (legacy)
// ============================================================================

const addLessonResourceSchema = z.object({
  lesson_id: z.string().uuid(),
  type: z.enum(["youtube", "pdf", "filerun", "url"]),
  url: z.string().url("Must be a valid URL"),
  title: z.string().optional(),
});

async function fetchYouTubeMeta(url: string, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
      { signal: controller.signal }
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { title?: string; thumbnail_url?: string };
    return {
      title: data.title || "",
      thumbnail_url: data.thumbnail_url || "",
    };
  } catch (err) {
    console.warn("YouTube metadata lookup failed", {
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

const replaceLessonResourcesSchema = z.object({
  lesson_id: z.string().uuid(),
  resources: z
    .array(
      z.object({
        type: z.enum(["youtube", "pdf", "filerun", "url"]),
        url: z.string().url("Must be a valid URL"),
        title: z.string().optional(),
      })
    )
    .max(50),
});

export async function replaceLessonResources(input: {
  lesson_id: string;
  resources: Array<{ type: "youtube" | "pdf" | "filerun" | "url"; url: string; title?: string }>;
}) {
  const parsed = replaceLessonResourcesSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { lesson_id, resources } = parsed.data;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM lesson_resources WHERE lesson_id = $1", [lesson_id]);

    for (const resource of resources) {
      const youtubeMeta =
        resource.type === "youtube" ? await fetchYouTubeMeta(resource.url) : null;
      const finalTitle = resource.title || youtubeMeta?.title || null;
      const finalThumbnail = youtubeMeta?.thumbnail_url || null;

      await client.query(
        `INSERT INTO lesson_resources (lesson_id, type, url, title, thumbnail_url)
         VALUES ($1, $2, $3, $4, $5)`,
        [lesson_id, resource.type, resource.url, finalTitle, finalThumbnail]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to replace lesson resources", {
      lesson_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to save lesson resources" };
  } finally {
    client.release();
  }

  revalidatePath("/lessons");
  revalidatePath("/calendar");
  revalidatePath("/resources");
  revalidatePath("/curricula");
  revalidatePath("/subjects");
  return { success: true };
}

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
  const youtubeMeta = type === "youtube" ? await fetchYouTubeMeta(url) : null;
  const finalTitle = title || youtubeMeta?.title || null;
  const finalThumbnail = youtubeMeta?.thumbnail_url || null;

  try {
    await pool.query(
      `INSERT INTO lesson_resources (lesson_id, type, url, title, thumbnail_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [lesson_id, type, url, finalTitle, finalThumbnail]
    );
  } catch (err) {
    console.error("Failed to add lesson resource", {
      lessonId: lesson_id,
      type,
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to add resource" };
  }

  revalidatePath("/lessons");
  revalidatePath("/calendar");
  revalidatePath("/resources");
  revalidatePath("/curricula");
  revalidatePath("/subjects");
  return { success: true };
}

export async function deleteLessonResource(resourceId: string) {
  const parsed = z.string().uuid().safeParse(resourceId);
  if (!parsed.success) return { error: "Invalid resource ID" };

  try {
    await pool.query("DELETE FROM lesson_resources WHERE id = $1", [parsed.data]);
  } catch (err) {
    console.error("Failed to delete lesson resource", {
      resourceId: parsed.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to delete resource" };
  }

  revalidatePath("/lessons");
  revalidatePath("/calendar");
  revalidatePath("/resources");
  revalidatePath("/curricula");
  revalidatePath("/subjects");
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
  author: z.string().optional(),
  url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  booklist_ids: z.array(z.string().uuid()).default([]),
});

export async function createGlobalResource(formData: FormData) {
  const data = createGlobalResourceSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    author: formData.get("author") || undefined,
    url: formData.get("url") || undefined,
    thumbnail_url: formData.get("thumbnail_url") || undefined,
    description: formData.get("description") || undefined,
    tags: formData.get("tags") || undefined,
    booklist_ids: formData.getAll("booklist_ids"),
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { title, type, author, url, thumbnail_url, description, tags, booklist_ids } = data.data;
  const normalizedAuthor = type === "book" ? (author || "").trim() : "";
  const finalTags = mergeTagNames(tags, normalizedAuthor ? [normalizedAuthor] : []);

  const uploadedThumbnail = formData.get("thumbnail_file");
  const savedThumbnail = await saveUploadedImage(
    uploadedThumbnail instanceof File ? uploadedThumbnail : null,
    "resources"
  );
  if (savedThumbnail && "error" in savedThumbnail) return savedThumbnail;

  const nextThumbnailUrl = savedThumbnail?.path || thumbnail_url || null;

  const client = await pool.connect();
  let id: string;
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `INSERT INTO resources (title, type, author, url, thumbnail_url, description)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [title, type, normalizedAuthor || null, url || null, nextThumbnailUrl, description || null]
    );
    id = res.rows[0].id;
    await syncResourceTags(client, id, finalTags.join(", "));
    if (type === "book") {
      await syncResourceBooklists(client, id, booklist_ids);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to create global resource", {
      title,
      type,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to create resource" };
  } finally {
    client.release();
  }

  revalidatePath("/resources");
  revalidatePath("/lessons");
  revalidatePath("/curricula");
  return { success: true, id };
}

const updateGlobalResourceSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  type: resourceTypeSchema,
  author: z.string().optional(),
  url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  booklist_ids: z.array(z.string().uuid()).default([]),
});

export async function updateGlobalResource(formData: FormData) {
  const data = updateGlobalResourceSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    type: formData.get("type"),
    author: formData.get("author") || undefined,
    url: formData.get("url") || undefined,
    thumbnail_url: formData.get("thumbnail_url") || undefined,
    description: formData.get("description") || undefined,
    tags: formData.get("tags") || undefined,
    booklist_ids: formData.getAll("booklist_ids"),
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { id, title, type, author, url, thumbnail_url, description, tags, booklist_ids } = data.data;
  const normalizedAuthor = type === "book" ? (author || "").trim() : "";
  const finalTags = mergeTagNames(tags, normalizedAuthor ? [normalizedAuthor] : []);

  const uploadedThumbnail = formData.get("thumbnail_file");
  const savedThumbnail = await saveUploadedImage(
    uploadedThumbnail instanceof File ? uploadedThumbnail : null,
    "resources"
  );
  if (savedThumbnail && "error" in savedThumbnail) return savedThumbnail;

  const clearThumbnail = formData.get("clear_thumbnail") === "true";
  const nextThumbnailUrl = clearThumbnail
    ? null
    : savedThumbnail?.path || thumbnail_url || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE resources SET title = $1, type = $2, author = $3, url = $4, thumbnail_url = $5, description = $6
       WHERE id = $7`,
      [title, type, normalizedAuthor || null, url || null, nextThumbnailUrl, description || null, id]
    );
    await syncResourceTags(client, id, finalTags.join(", "));
    if (type === "book") {
      await syncResourceBooklists(client, id, booklist_ids);
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to update global resource", {
      resourceId: id,
      type,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to update resource" };
  } finally {
    client.release();
  }

  revalidatePath("/resources");
  revalidatePath(`/resources/${id}`);
  revalidatePath("/lessons");
  revalidatePath("/curricula");
  return { success: true };
}

export async function deleteGlobalResource(resourceId: string) {
  const parsed = z.string().uuid().safeParse(resourceId);
  if (!parsed.success) return { error: "Invalid resource ID" };

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Unlink from lessons first
    await client.query(
      "UPDATE lesson_resources SET resource_id = NULL WHERE resource_id = $1",
      [parsed.data]
    );

    await client.query("DELETE FROM resources WHERE id = $1", [parsed.data]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to delete global resource", {
      resourceId: parsed.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to delete resource" };
  } finally {
    client.release();
  }

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

  try {
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
  } catch (err) {
    console.error("Failed to attach resource to lessons", {
      resourceId: rId,
      lessonIds: lIds,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to attach resource" };
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

  try {
    await pool.query(
      "DELETE FROM lesson_resources WHERE resource_id = $1 AND lesson_id = $2",
      [parsedR.data, parsedL.data]
    );
  } catch (err) {
    console.error("Failed to detach resource from lesson", {
      resourceId: parsedR.data,
      lessonId: parsedL.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to detach resource" };
  }

  revalidatePath("/resources");
  revalidatePath(`/resources/${parsedR.data}`);
  revalidatePath("/lessons");
  return { success: true };
}

const bulkSupplySchema = z.object({
  lessonId: z.string().uuid(),
  lines: z.string().min(1),
});

export async function bulkAddSuppliesToLesson(lessonId: string, lines: string) {
  const parsed = bulkSupplySchema.safeParse({ lessonId, lines });
  if (!parsed.success) return { error: "Invalid input" };

  const names = parsed.data.lines
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (names.length === 0) return { error: "No supplies found" };

  const client = await pool.connect();
  let created = 0;
  try {
    await client.query("BEGIN");
    for (const name of names) {
      const resourceRes = await client.query(
        `INSERT INTO resources (title, type)
         VALUES ($1, 'supply')
         RETURNING id`,
        [name]
      );
      const resourceId = resourceRes.rows[0].id as string;
      await client.query(
        `INSERT INTO lesson_resources (lesson_id, resource_id, type, url, title)
         VALUES ($1, $2, 'url', '', $3)`,
        [parsed.data.lessonId, resourceId, name]
      );
      created += 1;
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed bulk supply import", {
      lessonId: parsed.data.lessonId,
      count: names.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to add supplies" };
  } finally {
    client.release();
  }

  revalidatePath("/lessons");
  revalidatePath("/week");
  revalidatePath("/resources");
  return { success: true, created };
}

// ============================================================================
// CURRICULUM-LEVEL RESOURCES (shared across all lessons in a curriculum)
// ============================================================================

export async function attachResourceToCurriculum(
  resourceId: string,
  curriculumId: string,
  notes?: string
) {
  const parsedR = z.string().uuid().safeParse(resourceId);
  const parsedC = z.string().uuid().safeParse(curriculumId);
  if (!parsedR.success || !parsedC.success) return { error: "Invalid input" };

  try {
    await pool.query(
      `INSERT INTO curriculum_resources (curriculum_id, resource_id, notes)
       VALUES ($1, $2, $3)
       ON CONFLICT (curriculum_id, resource_id) DO NOTHING`,
      [parsedC.data, parsedR.data, notes || null]
    );
  } catch (err) {
    console.error("Failed to attach resource to curriculum", {
      resourceId: parsedR.data,
      curriculumId: parsedC.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to attach resource to curriculum" };
  }

  revalidatePath("/resources");
  revalidatePath(`/curricula/${parsedC.data}`);
  revalidatePath("/lessons");
  return { success: true };
}

export async function detachResourceFromCurriculum(
  resourceId: string,
  curriculumId: string
) {
  const parsedR = z.string().uuid().safeParse(resourceId);
  const parsedC = z.string().uuid().safeParse(curriculumId);
  if (!parsedR.success || !parsedC.success) return { error: "Invalid input" };

  try {
    await pool.query(
      "DELETE FROM curriculum_resources WHERE resource_id = $1 AND curriculum_id = $2",
      [parsedR.data, parsedC.data]
    );
  } catch (err) {
    console.error("Failed to detach resource from curriculum", {
      resourceId: parsedR.data,
      curriculumId: parsedC.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to detach resource from curriculum" };
  }

  revalidatePath("/resources");
  revalidatePath(`/curricula/${parsedC.data}`);
  revalidatePath("/lessons");
  return { success: true };
}
