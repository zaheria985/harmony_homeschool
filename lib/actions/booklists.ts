"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PoolClient } from "pg";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/session";

const booklistSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  resourceIds: z.array(z.string().uuid()).default([]),
});

const updateBooklistSchema = booklistSchema.extend({
  id: z.string().uuid(),
});

async function validateBookResourceIds(resourceIds: string[]) {
  if (resourceIds.length === 0) return true;
  const res = await pool.query(
    `SELECT id
     FROM resources
     WHERE type = 'book' AND id = ANY($1::uuid[])`,
    [resourceIds]
  );
  return res.rows.length === new Set(resourceIds).size;
}

async function replaceBooklistResources(
  client: PoolClient,
  booklistId: string,
  resourceIds: string[]
) {
  await client.query("DELETE FROM booklist_resources WHERE booklist_id = $1", [booklistId]);
  for (let i = 0; i < resourceIds.length; i += 1) {
    await client.query(
      `INSERT INTO booklist_resources (booklist_id, resource_id, position)
       VALUES ($1, $2, $3)`,
      [booklistId, resourceIds[i], i]
    );
  }
}

async function canKidEditBooklist(booklistId: string, childId: string) {
  const res = await pool.query(
    `SELECT id FROM booklists WHERE id = $1 AND owner_child_id = $2`,
    [booklistId, childId]
  );
  return !!res.rows[0];
}

export async function createBooklist(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role === "kid") {
    return { error: "Students cannot create shared booklists" };
  }
  const data = booklistSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    resourceIds: formData.getAll("resource_ids"),
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const resourceIds = Array.from(new Set(data.data.resourceIds));
  let areResourcesValid = false;
  try {
    areResourcesValid = await validateBookResourceIds(resourceIds);
  } catch (err) {
    console.error("Failed to validate selected books", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to validate selected books" };
  }
  if (!areResourcesValid) {
    return { error: "Booklists can only include book resources" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO booklists (name, description)
       VALUES ($1, $2)
       RETURNING id`,
      [data.data.name.trim(), data.data.description || null]
    );

    await replaceBooklistResources(client, created.rows[0].id, resourceIds);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to create booklist", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to create booklist" };
  } finally {
    client.release();
  }

  revalidatePath("/booklists");
  revalidatePath("/resources");
  return { success: true };
}

export async function updateBooklist(formData: FormData) {
  const user = await getCurrentUser();
  if (user.role === "kid") {
    return { error: "Students cannot edit shared booklists" };
  }
  const data = updateBooklistSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    resourceIds: formData.getAll("resource_ids"),
  });

  if (!data.success) {
    return { error: data.error.errors[0]?.message || "Invalid input" };
  }

  const resourceIds = Array.from(new Set(data.data.resourceIds));
  let areResourcesValid = false;
  try {
    areResourcesValid = await validateBookResourceIds(resourceIds);
  } catch (err) {
    console.error("Failed to validate selected books", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to validate selected books" };
  }
  if (!areResourcesValid) {
    return { error: "Booklists can only include book resources" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE booklists
       SET name = $1, description = $2
       WHERE id = $3`,
      [
        data.data.name.trim(),
        data.data.description || null,
        data.data.id,
      ]
    );

    await replaceBooklistResources(client, data.data.id, resourceIds);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to update booklist", {
      booklistId: data.data.id,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to update booklist" };
  } finally {
    client.release();
  }

  revalidatePath("/booklists");
  revalidatePath("/resources");
  return { success: true };
}

export async function deleteBooklist(id: string) {
  const user = await getCurrentUser();
  if (user.role === "kid") {
    return { error: "Students cannot delete shared booklists" };
  }
  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid booklist ID" };

  try {
    await pool.query("DELETE FROM booklists WHERE id = $1", [parsed.data]);
  } catch (err) {
    console.error("Failed to delete booklist", {
      booklistId: parsed.data,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to delete booklist" };
  }

  revalidatePath("/booklists");
  return { success: true };
}

const addBookToBooklistSchema = z.object({
  booklistId: z.string().uuid(),
  resourceId: z.string().uuid(),
});

export async function addBookToBooklist(booklistId: string, resourceId: string) {
  const user = await getCurrentUser();
  const parsed = addBookToBooklistSchema.safeParse({ booklistId, resourceId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  try {
    if (user.role === "kid") {
      if (!user.childId) return { error: "Student account is not linked to a child" };
      const allowed = await canKidEditBooklist(parsed.data.booklistId, user.childId);
      if (!allowed) return { error: "You can only add books to your own wishlist" };
    }

    const validRes = await pool.query(
      `SELECT id FROM resources WHERE id = $1 AND type = 'book'`,
      [parsed.data.resourceId]
    );
    if (!validRes.rows[0]) return { error: "Only book resources can be added" };

    await pool.query(
      `INSERT INTO booklist_resources (booklist_id, resource_id, position)
       VALUES (
         $1,
         $2,
         COALESCE((SELECT MAX(position) + 1 FROM booklist_resources WHERE booklist_id = $1), 0)
       )
       ON CONFLICT (booklist_id, resource_id) DO NOTHING`,
      [parsed.data.booklistId, parsed.data.resourceId]
    );
  } catch (err) {
    console.error("Failed to add book to booklist", {
      booklistId: parsed.data.booklistId,
      resourceId: parsed.data.resourceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to add book to booklist" };
  }

  revalidatePath("/booklists");
  return { success: true };
}

const addBookToPersonalWishlistSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1),
});

export async function addBookToPersonalWishlist(title: string, author: string) {
  const user = await getCurrentUser();
  if (user.role !== "kid" || !user.childId) {
    return { error: "Only student accounts can use this flow" };
  }

  const parsed = addBookToPersonalWishlistSchema.safeParse({ title, author });
  if (!parsed.success) return { error: "Title and author are required" };

  const listRes = await pool.query(
    `SELECT id FROM booklists WHERE owner_child_id = $1 LIMIT 1`,
    [user.childId]
  );
  const wishlistId = listRes.rows[0]?.id as string | undefined;
  if (!wishlistId) return { error: "No personal wishlist found" };

  let thumbnailUrl: string | null = null;
  const olUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(parsed.data.title)}&author=${encodeURIComponent(parsed.data.author)}&limit=1`;
  console.log("[openlibrary] fetching cover", { title: parsed.data.title, author: parsed.data.author, url: olUrl });
  try {
    const lookup = await fetch(olUrl);
    console.log("[openlibrary] response status:", lookup.status);
    if (lookup.ok) {
      const data = (await lookup.json()) as { docs?: Array<{ cover_i?: number }> };
      const coverId = data.docs?.[0]?.cover_i;
      console.log("[openlibrary] cover_i:", coverId ?? "not found", "docs:", data.docs?.length ?? 0);
      if (coverId) {
        thumbnailUrl = `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`;
      }
    }
  } catch (err) {
    console.warn("[openlibrary] fetch failed", {
      title: parsed.data.title,
      author: parsed.data.author,
      error: err instanceof Error ? err.message : String(err),
    });
    thumbnailUrl = null;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO resources (title, type, author, thumbnail_url)
       VALUES ($1, 'book', $2, $3)
       RETURNING id`,
      [parsed.data.title.trim(), parsed.data.author.trim(), thumbnailUrl]
    );
    const resourceId = created.rows[0].id as string;

    const authorTag = parsed.data.author.trim().toLowerCase();
    const tagRes = await client.query(
      `INSERT INTO tags (name)
       VALUES ($1)
       ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [authorTag]
    );
    await client.query(
      `INSERT INTO resource_tags (resource_id, tag_id)
       VALUES ($1, $2)
       ON CONFLICT (resource_id, tag_id) DO NOTHING`,
      [resourceId, tagRes.rows[0].id]
    );

    await client.query(
      `INSERT INTO booklist_resources (booklist_id, resource_id, position)
       VALUES (
         $1,
         $2,
         COALESCE((SELECT MAX(position) + 1 FROM booklist_resources WHERE booklist_id = $1), 0)
       )`,
      [wishlistId, resourceId]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to add book to personal wishlist", {
      childId: user.childId,
      title: parsed.data.title,
      author: parsed.data.author,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to add book to wishlist" };
  } finally {
    client.release();
  }

  revalidatePath("/booklists");
  revalidatePath("/resources");
  return { success: true };
}

// --- Bulk import ---

const bulkImportSchema = z.object({
  books: z.array(z.object({
    title: z.string().min(1),
    author: z.string().default(""),
  })).min(1, "At least one book is required"),
  booklistId: z.string().uuid().optional(),
});

export async function bulkImportBooks(
  books: { title: string; author: string }[],
  booklistId?: string,
) {
  const user = await getCurrentUser();
  if (user.role === "kid") {
    return { error: "Students cannot bulk import books" };
  }

  const parsed = bulkImportSchema.safeParse({ books, booklistId });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const client = await pool.connect();
  let imported = 0;

  try {
    await client.query("BEGIN");

    for (const book of parsed.data.books) {
      const title = book.title.trim();
      const author = book.author.trim();
      if (!title) continue;

      // Create the book resource
      const created = await client.query(
        `INSERT INTO resources (title, type, author)
         VALUES ($1, 'book', $2)
         RETURNING id`,
        [title, author || null]
      );
      const resourceId = created.rows[0].id as string;

      // Auto-tag with author name if present
      if (author) {
        const authorTag = author.toLowerCase();
        const tagRes = await client.query(
          `INSERT INTO tags (name)
           VALUES ($1)
           ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [authorTag]
        );
        await client.query(
          `INSERT INTO resource_tags (resource_id, tag_id)
           VALUES ($1, $2)
           ON CONFLICT (resource_id, tag_id) DO NOTHING`,
          [resourceId, tagRes.rows[0].id]
        );
      }

      // Add to booklist if specified
      if (parsed.data.booklistId) {
        await client.query(
          `INSERT INTO booklist_resources (booklist_id, resource_id, position)
           VALUES (
             $1, $2,
             COALESCE((SELECT MAX(position) + 1 FROM booklist_resources WHERE booklist_id = $1), 0)
           )
           ON CONFLICT (booklist_id, resource_id) DO NOTHING`,
          [parsed.data.booklistId, resourceId]
        );
      }

      imported++;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to bulk import books", {
      count: parsed.data.books.length,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to import books" };
  } finally {
    client.release();
  }

  revalidatePath("/booklists");
  revalidatePath("/resources");
  return { success: true, imported };
}

const createBooklistFromTagsSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  tags: z.array(z.string().min(1)).min(1, "Select at least one tag"),
});

export async function createBooklistFromTags(
  name: string,
  tags: string[],
  description?: string
) {
  const parsed = createBooklistFromTagsSchema.safeParse({ name, tags, description });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Invalid input" };
  }

  const normalizedTags = Array.from(new Set(parsed.data.tags.map((tag) => tag.toLowerCase().trim())));

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const created = await client.query(
      `INSERT INTO booklists (name, description)
       VALUES ($1, $2)
       RETURNING id`,
      [parsed.data.name.trim(), parsed.data.description || null]
    );

    const booklistId = created.rows[0].id as string;

    const booksRes = await client.query(
      `SELECT DISTINCT r.id
       FROM resources r
       JOIN resource_tags rt ON rt.resource_id = r.id
       JOIN tags t ON t.id = rt.tag_id
       WHERE r.type = 'book'
         AND t.name = ANY($1::text[])
       ORDER BY r.id`,
      [normalizedTags]
    );

    let position = 0;
    for (const row of booksRes.rows as { id: string }[]) {
      await client.query(
        `INSERT INTO booklist_resources (booklist_id, resource_id, position)
         VALUES ($1, $2, $3)
         ON CONFLICT (booklist_id, resource_id) DO NOTHING`,
        [booklistId, row.id, position]
      );
      position += 1;
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to create booklist from tags", {
      name: parsed.data.name,
      tags: normalizedTags,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to create booklist from tags" };
  } finally {
    client.release();
  }

  revalidatePath("/booklists");
  revalidatePath("/resources");
  return { success: true };
}

// --- Curriculum-linked booklists ---

const linkBooklistSchema = z.object({
  curriculumId: z.string().uuid(),
  booklistId: z.string().uuid(),
});

export async function linkBooklistToCurriculum(
  curriculumId: string,
  booklistId: string,
) {
  const parsed = linkBooklistSchema.safeParse({ curriculumId, booklistId });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await pool.query(
      `INSERT INTO curriculum_booklists (curriculum_id, booklist_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [parsed.data.curriculumId, parsed.data.booklistId]
    );
  } catch (err) {
    console.error("Failed to link booklist", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to link booklist" };
  }

  revalidatePath("/curricula");
  revalidatePath("/booklists");
  return { success: true };
}

export async function unlinkBooklistFromCurriculum(
  curriculumId: string,
  booklistId: string,
) {
  const parsed = linkBooklistSchema.safeParse({ curriculumId, booklistId });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await pool.query(
      `DELETE FROM curriculum_booklists
       WHERE curriculum_id = $1 AND booklist_id = $2`,
      [parsed.data.curriculumId, parsed.data.booklistId]
    );
  } catch (err) {
    console.error("Failed to unlink booklist", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to unlink booklist" };
  }

  revalidatePath("/curricula");
  revalidatePath("/booklists");
  return { success: true };
}
