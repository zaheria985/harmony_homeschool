"use server";

import { requireParent } from "@/lib/server/authz";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PoolClient } from "pg";
import pool from "@/lib/db";
import { saveUploadedImage } from "@/lib/server/uploads";
import { findBookCover, COVER_LOOKUP_DELAY_MS } from "@/lib/server/book-covers";
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
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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

const resourceTypeSchema = z.enum(["book", "video", "pdf", "link", "supply", "local_file"]);

const createGlobalResourceSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: resourceTypeSchema,
  author: z.string().optional(),
  url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  description: z.string().optional(),
  tags: z.string().optional(),
  booklist_ids: z.array(z.string().uuid()).default([]),
  category: z.enum(["learning", "asset"]).default("learning"),
});

export async function createGlobalResource(formData: FormData) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const data = createGlobalResourceSchema.safeParse({
    title: formData.get("title"),
    type: formData.get("type"),
    author: formData.get("author") || undefined,
    url: formData.get("url") || undefined,
    thumbnail_url: formData.get("thumbnail_url") || undefined,
    description: formData.get("description") || undefined,
    tags: formData.get("tags") || undefined,
    booklist_ids: formData.getAll("booklist_ids"),
    category: formData.get("category") || "learning",
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { title, type, author, url, thumbnail_url, description, tags, booklist_ids, category } = data.data;
  const normalizedAuthor = type === "book" ? (author || "").trim() : "";
  const finalTags = mergeTagNames(tags, normalizedAuthor ? [normalizedAuthor] : []);

  const uploadedThumbnail = formData.get("thumbnail_file");
  const savedThumbnail = await saveUploadedImage(
    uploadedThumbnail instanceof File ? uploadedThumbnail : null,
    "resources"
  );
  if (savedThumbnail && "error" in savedThumbnail) return savedThumbnail;

  let nextThumbnailUrl = savedThumbnail?.path || thumbnail_url || null;

  // Auto-fetch cover from OpenLibrary for books without a thumbnail
  if (!nextThumbnailUrl && type === "book" && title) {
    nextThumbnailUrl = await findBookCover(title, normalizedAuthor);
  }

  const client = await pool.connect();
  let id: string;
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `INSERT INTO resources (title, type, author, url, thumbnail_url, description, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [title, type, normalizedAuthor || null, url || null, nextThumbnailUrl, description || null, category]
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
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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

/**
 * Look a cover up again for one book. Used by the "Refresh cover" button —
 * the common case is a book whose author was mistyped when it was created, so
 * the original lookup found nothing.
 *
 * Only overwrites on a hit: a failed retry must not wipe the cover that is
 * already there.
 */
export async function refreshBookCover(resourceId: string) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = z.string().uuid().safeParse(resourceId);
  if (!parsed.success) return { error: "Invalid resource ID" };

  const res = await pool.query(
    `SELECT title, author, type FROM resources WHERE id = $1`,
    [parsed.data],
  );
  const book = res.rows[0] as
    | { title: string; author: string | null; type: string }
    | undefined;
  if (!book) return { error: "Resource not found" };
  if (book.type !== "book") return { error: "Only books have covers to fetch" };

  const cover = await findBookCover(book.title, book.author);
  if (!cover) return { error: "No cover found for that title and author" };

  await pool.query(`UPDATE resources SET thumbnail_url = $1 WHERE id = $2`, [
    cover,
    parsed.data,
  ]);

  revalidatePath("/resources");
  revalidatePath(`/resources/${parsed.data}`);
  revalidatePath("/booklists");
  return { success: true, thumbnail_url: cover };
}

/**
 * Fill in covers for every book that has none.
 *
 * Runs the lookups one at a time with a delay — OpenLibrary asks for about a
 * request per second, and a homeschool library is a few hundred books, so
 * this is a minute or two of patience rather than something to parallelize.
 * A book that still has no match is left alone and counted, not retried.
 */
export async function backfillBookCovers() {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };

  const res = await pool.query(
    `SELECT id, title, author FROM resources
     WHERE type = 'book' AND (thumbnail_url IS NULL OR thumbnail_url = '')
     ORDER BY title`,
  );
  const books = res.rows as Array<{
    id: string;
    title: string;
    author: string | null;
  }>;
  if (books.length === 0) {
    return {
      success: true,
      found: 0,
      missed: 0,
      total: 0,
      missedSample: [] as string[],
    };
  }

  let found = 0;
  const missedTitles: string[] = [];

  for (let index = 0; index < books.length; index++) {
    const book = books[index];
    if (index > 0) await sleep(COVER_LOOKUP_DELAY_MS);

    const cover = await findBookCover(book.title, book.author);
    if (!cover) {
      missedTitles.push(book.title);
      continue;
    }
    try {
      await pool.query(`UPDATE resources SET thumbnail_url = $1 WHERE id = $2`, [
        cover,
        book.id,
      ]);
      found++;
    } catch (err) {
      // One bad row must not end the run.
      console.warn("[book-covers] failed to store cover", {
        resourceId: book.id,
        error: err instanceof Error ? err.message : String(err),
      });
      missedTitles.push(book.title);
    }
  }

  revalidatePath("/resources");
  revalidatePath("/booklists");
  revalidatePath("/admin");
  return {
    success: true,
    found,
    missed: missedTitles.length,
    total: books.length,
    // Enough to spot a pattern (bad author, obscure title) without a wall of text.
    missedSample: missedTitles.slice(0, 8),
  };
}

export async function deleteGlobalResource(resourceId: string) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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

export async function bulkDeleteResources(ids: string[]) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = z.array(z.string().uuid()).min(1).safeParse(ids);
  if (!parsed.success) {
    console.error("[bulkDeleteResources] Zod validation failed:", parsed.error.issues);
    return { error: "Invalid input" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const id of parsed.data) {
      // Unlink from lesson_resources (also handled by ON DELETE SET NULL, but explicit)
      const unlinkResult = await client.query(
        "UPDATE lesson_resources SET resource_id = NULL WHERE resource_id = $1",
        [id]
      );
      // Delete the resource (cascades to resource_tags, booklist_resources, curriculum_resources)
      const deleteResult = await client.query("DELETE FROM resources WHERE id = $1", [id]);
      console.log(`[bulkDeleteResources] id=${id} unlinked=${unlinkResult.rowCount} deleted=${deleteResult.rowCount}`);
      if (deleteResult.rowCount === 0) {
        console.warn(`[bulkDeleteResources] Resource ${id} not found in DB — may already be deleted`);
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[bulkDeleteResources] Transaction failed:", {
      ids: parsed.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to delete resources" };
  } finally {
    client.release();
  }

  revalidatePath("/resources");
  revalidatePath("/lessons");
  revalidatePath("/booklists");
  return { success: true, deleted: parsed.data.length };
}

const attachSchema = z.object({
  resourceId: z.string().uuid(),
  lessonIds: z.array(z.string().uuid()).min(1, "Select at least one lesson"),
});

export async function attachResourceToLessons(
  resourceId: string,
  lessonIds: string[]
) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const data = attachSchema.safeParse({ resourceId, lessonIds });
  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const { resourceId: rId, lessonIds: lIds } = data.data;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resource = await client.query(
      "SELECT title, type, url FROM resources WHERE id = $1",
      [rId]
    );
    if (!resource.rows[0]) {
      await client.query("ROLLBACK");
      return { error: "Resource not found" };
    }

    const r = resource.rows[0];
    // Map resource types to lesson_resources types
    const lrType = r.type === "video" ? "youtube" : ["youtube", "pdf", "url"].includes(r.type) ? r.type : "url";

    for (const lessonId of lIds) {
      await client.query(
        `INSERT INTO lesson_resources (lesson_id, resource_id, type, url, title)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (lesson_id, resource_id) DO NOTHING`,
        [lessonId, rId, lrType, r.url || "", r.title]
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to attach resource to lessons", {
      resourceId: rId,
      lessonIds: lIds,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to attach resource" };
  } finally {
    client.release();
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
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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
// BULK LESSON RESOURCES (used by Trello import)
// ============================================================================

import { downloadTrelloFile, sleep } from "@/lib/server/trello-download";

const bulkLessonResourceSchema = z.object({
  lessonId: z.string().uuid(),
  resources: z.array(
    z.object({
      type: z.enum(["youtube", "pdf", "url"]),
      url: z.string().url(),
      title: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      downloadUrl: z.string().optional(),
    })
  ),
});

export async function bulkCreateLessonResources(
  items: Array<{
    lessonId: string;
    resources: Array<{
      type: "youtube" | "pdf" | "url";
      url: string;
      title?: string;
      thumbnailUrl?: string;
      downloadUrl?: string;
    }>;
  }>
) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = z.array(bulkLessonResourceSchema).safeParse(items);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const client = await pool.connect();
  let created = 0;
  let downloaded = 0;

  try {
    await client.query("BEGIN");

    for (const item of parsed.data) {
      for (const resource of item.resources) {
        let finalUrl = resource.url;
        let finalThumbnail = resource.thumbnailUrl || null;

        // Download Trello-hosted files locally
        if (resource.downloadUrl) {
          console.log("[bulk-resources] downloading", resource.downloadUrl.slice(0, 80));
          if (downloaded > 0) await sleep(300);
          const result = await downloadTrelloFile(resource.downloadUrl);
          if (result) {
            finalUrl = result.localPath;
            // Use local path as thumbnail for images
            const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(result.localPath);
            if (isImage) finalThumbnail = result.localPath;
            downloaded++;
          }
        }

        // YouTube oembed lookup
        const youtubeMeta =
          resource.type === "youtube" ? await fetchYouTubeMeta(resource.url) : null;
        const finalTitle = resource.title || youtubeMeta?.title || null;
        if (!finalThumbnail) {
          finalThumbnail = youtubeMeta?.thumbnail_url || null;
        }

        await client.query(
          `INSERT INTO lesson_resources (lesson_id, type, url, title, thumbnail_url)
           VALUES ($1, $2, $3, $4, $5)`,
          [item.lessonId, resource.type, finalUrl, finalTitle, finalThumbnail]
        );
        created++;
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to bulk create lesson resources", {
      itemCount: parsed.data.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to create lesson resources" };
  } finally {
    client.release();
  }

  revalidatePath("/lessons");
  revalidatePath("/resources");
  revalidatePath("/curricula");
  return { success: true, created, downloaded };
}

// ============================================================================
// CURRICULUM-LEVEL RESOURCES (shared across all lessons in a curriculum)
// ============================================================================

export async function attachResourceToCurriculum(
  resourceId: string,
  curriculumId: string,
  notes?: string
) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
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

export async function promoteInlineResource(lessonResourceId: string) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = z.string().uuid().safeParse(lessonResourceId);
  if (!parsed.success) return { error: "Invalid ID" };

  const lrRes = await pool.query(
    `SELECT lr.id, lr.lesson_id, lr.type, lr.url, lr.title, lr.thumbnail_url, lr.resource_id
     FROM lesson_resources lr WHERE lr.id = $1`,
    [parsed.data]
  );
  if (lrRes.rows.length === 0) return { error: "Lesson resource not found" };
  const lr = lrRes.rows[0];
  if (lr.resource_id) return { error: "Already linked to a global resource" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const globalRes = await client.query(
      `INSERT INTO resources (title, type, url, thumbnail_url)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [lr.title || "Untitled", lr.type || "link", lr.url, lr.thumbnail_url]
    );
    const globalId = globalRes.rows[0].id;
    await client.query(
      `UPDATE lesson_resources SET resource_id = $1 WHERE id = $2`,
      [globalId, parsed.data]
    );
    await client.query("COMMIT");
    revalidatePath("/resources");
    revalidatePath("/lessons");
    revalidatePath("/curricula");
    return { success: true, resourceId: globalId };
  } catch (err) {
    await client.query("ROLLBACK");
    return { error: "Failed to promote resource" };
  } finally {
    client.release();
  }
}

const bulkImportSchema = z.object({
  text: z.string().min(1, "Paste at least one line"),
});

export async function bulkImportResources(formData: FormData) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = bulkImportSchema.safeParse({
    text: formData.get("text"),
  });
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const lines = parsed.data.text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return { error: "No lines found" };

  const validTypes = new Set(["book", "video", "pdf", "link", "supply", "local_file"]);
  let imported = 0;
  let skipped = 0;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    for (const line of lines) {
      // Support pipe-separated or CSV
      const parts = line.includes("|")
        ? line.split("|").map((p) => p.trim())
        : line.split(",").map((p) => p.trim());

      const title = parts[0] || "";
      const rawType = (parts[1] || "link").toLowerCase();
      const url = parts[2] || "";

      if (!title) {
        skipped++;
        continue;
      }

      const type = validTypes.has(rawType) ? rawType : "link";

      // Check for duplicate by title+url
      const existing = await client.query(
        `SELECT id FROM resources WHERE title = $1 AND COALESCE(url, '') = $2`,
        [title, url]
      );
      if (existing.rows.length > 0) {
        skipped++;
        continue;
      }

      // Books get the same cover treatment as every other creation path.
      const thumbnailUrl = type === "book" ? await findBookCover(title) : null;

      await client.query(
        `INSERT INTO resources (title, type, url, thumbnail_url) VALUES ($1, $2, $3, $4)`,
        [title, type, url || null, thumbnailUrl]
      );
      imported++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to bulk import resources", {
      lineCount: lines.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to import resources" };
  } finally {
    client.release();
  }

  revalidatePath("/resources");
  return { success: true, imported, skipped };
}

export async function bulkAddTagsToResources(resourceIds: string[], tagNames: string[]) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsedIds = z.array(z.string().uuid()).min(1).safeParse(resourceIds);
  const parsedTags = z.array(z.string().min(1)).min(1).safeParse(tagNames);
  if (!parsedIds.success || !parsedTags.success) return { error: "Invalid input" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const tagName of parsedTags.data) {
      const tagRes = await client.query(
        `INSERT INTO tags (name) VALUES ($1)
         ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [tagName.toLowerCase().trim()]
      );
      const tagId = tagRes.rows[0].id;
      for (const resourceId of parsedIds.data) {
        await client.query(
          `INSERT INTO resource_tags (resource_id, tag_id)
           VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [resourceId, tagId]
        );
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    return { error: "Failed to add tags" };
  } finally {
    client.release();
  }

  revalidatePath("/resources");
  return { success: true };
}

/** Books the picker offers; kept small because it feeds a dropdown. */
export async function searchBooksForPicker(query: string) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = z.string().max(200).safeParse(query);
  if (!parsed.success) return { error: "Invalid search" };
  const { searchBookResources } = await import("@/lib/queries/resources");
  return { results: await searchBookResources(parsed.data) };
}

const attachBookSchema = z.object({
  lessonId: z.string().uuid(),
  resourceId: z.string().uuid().optional(),
  title: z.string().min(1).optional(),
  author: z.string().optional(),
  pageRef: z.string().optional(),
});

/**
 * Put a book on a lesson.
 *
 * A book is both something to read *and* something to carry to the table, so
 * it lands in two places on purpose: a `lesson_cards` row so the board shows
 * its cover, and a `lesson_resources` row so the planner's materials panel
 * counts it. Supplying `resourceId` attaches an existing book; supplying a
 * title creates one first (fetching a cover on the way, like every other
 * creation path).
 */
export async function attachBookToLesson(input: {
  lessonId: string;
  resourceId?: string;
  title?: string;
  author?: string;
  pageRef?: string;
}) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = attachBookSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }
  const { lessonId, resourceId, title, author, pageRef } = parsed.data;
  if (!resourceId && !title) return { error: "Pick a book or give it a title" };

  const client = await pool.connect();
  let bookId = resourceId;
  let createdNew = false;
  try {
    await client.query("BEGIN");

    if (!bookId && title) {
      const normalizedAuthor = (author || "").trim();
      // Reuse a matching book rather than growing a second copy of it.
      const existing = await client.query(
        `SELECT id FROM resources
         WHERE type = 'book' AND LOWER(title) = LOWER($1)
         ${normalizedAuthor ? "AND LOWER(COALESCE(author, '')) = LOWER($2)" : ""}
         LIMIT 1`,
        normalizedAuthor ? [title, normalizedAuthor] : [title],
      );
      if (existing.rows[0]) {
        bookId = existing.rows[0].id as string;
      } else {
        const cover = await findBookCover(title, normalizedAuthor);
        const created = await client.query(
          `INSERT INTO resources (title, type, author, thumbnail_url)
           VALUES ($1, 'book', $2, $3) RETURNING id`,
          [title.trim(), normalizedAuthor || null, cover],
        );
        bookId = created.rows[0].id as string;
        createdNew = true;
        if (normalizedAuthor) {
          await syncResourceTags(client, bookId, normalizedAuthor);
        }
      }
    }

    const bookRes = await client.query(
      `SELECT title, thumbnail_url FROM resources WHERE id = $1 AND type = 'book'`,
      [bookId],
    );
    const book = bookRes.rows[0] as
      | { title: string; thumbnail_url: string | null }
      | undefined;
    if (!book) {
      await client.query("ROLLBACK");
      return { error: "Book not found" };
    }

    const displayTitle = pageRef ? `${book.title} (${pageRef})` : book.title;

    // Board card, carrying the cover.
    const orderRes = await client.query(
      `SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM lesson_cards WHERE lesson_id = $1`,
      [lessonId],
    );
    await client.query(
      `INSERT INTO lesson_cards (lesson_id, card_type, title, resource_id, thumbnail_url, order_index)
       VALUES ($1, 'resource', $2, $3, $4, $5)`,
      [lessonId, displayTitle, bookId, book.thumbnail_url, orderRes.rows[0].next_idx],
    );

    // Materials row. `type` is constrained to the link kinds, so books ride
    // as 'url' with an empty url and let the joined resource say 'book' —
    // the same shape supplies use (see bulkAddSuppliesToLesson).
    await client.query(
      `INSERT INTO lesson_resources (lesson_id, resource_id, type, url, title)
       VALUES ($1, $2, 'url', '', $3)
       ON CONFLICT (lesson_id, resource_id) DO NOTHING`,
      [lessonId, bookId, displayTitle],
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to attach book to lesson", {
      lessonId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to attach book" };
  } finally {
    client.release();
  }

  const lessonRes = await pool.query(
    `SELECT curriculum_id FROM lessons WHERE id = $1`,
    [lessonId],
  );
  if (lessonRes.rows[0]) {
    revalidatePath(`/curricula/${lessonRes.rows[0].curriculum_id}/board`);
    revalidatePath(`/curricula/${lessonRes.rows[0].curriculum_id}/list`);
  }
  revalidatePath(`/lessons/${lessonId}`);
  revalidatePath("/week");
  revalidatePath("/resources");
  return { success: true, resourceId: bookId, createdNew };
}

// ============================================================================
// BULK FIND-OR-CREATE BOOKS + ATTACH TO LESSONS (for curriculum importer)
// ============================================================================

const bookAttachmentSchema = z.object({
  lessonId: z.string().uuid(),
  title: z.string().min(1),
  author: z.string().optional(),
  pageRef: z.string().optional(),
  source: z.string().optional(),
});

export async function bulkFindOrCreateAndAttachBooks(
  items: Array<{
    lessonId: string;
    title: string;
    author?: string;
    pageRef?: string;
    source?: string;
  }>
) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = z.array(bookAttachmentSchema).safeParse(items);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const client = await pool.connect();
  let created = 0;
  let attached = 0;

  try {
    await client.query("BEGIN");

    // Cache: title+author → resource id (to avoid duplicate lookups within batch)
    const bookCache = new Map<string, string>();

    for (const item of parsed.data) {
      const cacheKey = `${item.title.toLowerCase()}||${(item.author || "").toLowerCase()}`;
      let resourceId = bookCache.get(cacheKey);

      if (!resourceId) {
        // Try to find existing book resource by title (case-insensitive)
        const existing = await client.query(
          `SELECT id FROM resources
           WHERE type = 'book' AND LOWER(title) = LOWER($1)
           ${item.author ? "AND LOWER(author) = LOWER($2)" : ""}
           LIMIT 1`,
          item.author ? [item.title, item.author] : [item.title]
        );

        if (existing.rows[0]) {
          resourceId = existing.rows[0].id;
        } else {
          // Create book resource — auto-fetch OpenLibrary cover
          const normalizedAuthor = (item.author || "").trim();
          const thumbnailUrl = await findBookCover(item.title, normalizedAuthor);

          const res = await client.query(
            `INSERT INTO resources (title, type, author, thumbnail_url)
             VALUES ($1, 'book', $2, $3) RETURNING id`,
            [item.title, normalizedAuthor || null, thumbnailUrl]
          );
          resourceId = res.rows[0].id;
          created++;
        }

        bookCache.set(cacheKey, resourceId!);
      }

      // Attach book to lesson as a lesson_card (visual card with cover image)
      const displayTitle = item.pageRef
        ? `${item.title} (${item.pageRef})`
        : item.title;

      const resourceRow = await client.query(
        "SELECT thumbnail_url FROM resources WHERE id = $1",
        [resourceId]
      );

      // Get next order_index for this lesson's cards
      const orderRes = await client.query(
        "SELECT COALESCE(MAX(order_index), -1) + 1 AS next_idx FROM lesson_cards WHERE lesson_id = $1",
        [item.lessonId]
      );

      await client.query(
        `INSERT INTO lesson_cards (lesson_id, card_type, title, resource_id, thumbnail_url, order_index)
         VALUES ($1, 'resource', $2, $3, $4, $5)`,
        [item.lessonId, displayTitle, resourceId, resourceRow.rows[0]?.thumbnail_url || null, orderRes.rows[0].next_idx]
      );
      attached++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to bulk create/attach books", {
      itemCount: parsed.data.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to create book resources" };
  } finally {
    client.release();
  }

  revalidatePath("/resources");
  revalidatePath("/lessons");
  revalidatePath("/curricula");
  return { success: true, created, attached };
}
