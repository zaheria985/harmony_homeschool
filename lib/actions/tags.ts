"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";

const renameSchema = z.object({
  tagId: z.string().uuid(),
  newName: z.string().trim().min(1),
});

const deleteSchema = z.object({ tagId: z.string().uuid() });

const mergeSchema = z.object({
  sourceTagId: z.string().uuid(),
  targetTagId: z.string().uuid(),
});

function revalidateTags() {
  revalidatePath("/tags");
  revalidatePath("/resources");
  revalidatePath("/admin/tags");
}

const createSchema = z.object({ name: z.string().trim().min(1) });

export async function createTag(name: string) {
  const parsed = createSchema.safeParse({ name });
  if (!parsed.success) return { error: "Tag name is required" };

  try {
    await pool.query(
      `INSERT INTO tags (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [parsed.data.name.toLowerCase()]
    );
  } catch (err) {
    console.error("Failed to create tag", {
      name: parsed.data.name,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to create tag" };
  }

  revalidateTags();
  return { success: true };
}

export async function renameTag(tagId: string, newName: string) {
  const parsed = renameSchema.safeParse({ tagId, newName });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await pool.query(`UPDATE tags SET name = $1 WHERE id = $2`, [parsed.data.newName.toLowerCase(), parsed.data.tagId]);
  } catch (err) {
    console.error("Failed to rename tag", {
      tagId: parsed.data.tagId,
      newName: parsed.data.newName,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to rename tag" };
  }

  revalidateTags();
  return { success: true };
}

export async function deleteTag(tagId: string) {
  const parsed = deleteSchema.safeParse({ tagId });
  if (!parsed.success) return { error: "Invalid input" };

  try {
    await pool.query(`DELETE FROM tags WHERE id = $1`, [parsed.data.tagId]);
  } catch (err) {
    console.error("Failed to delete tag", {
      tagId: parsed.data.tagId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to delete tag" };
  }

  revalidateTags();
  return { success: true };
}

export async function mergeTags(sourceTagId: string, targetTagId: string) {
  const parsed = mergeSchema.safeParse({ sourceTagId, targetTagId });
  if (!parsed.success) return { error: "Invalid input" };
  if (parsed.data.sourceTagId === parsed.data.targetTagId) return { error: "Pick two different tags" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO resource_tags (resource_id, tag_id)
       SELECT resource_id, $2
       FROM resource_tags
       WHERE tag_id = $1
       ON CONFLICT (resource_id, tag_id) DO NOTHING`,
      [parsed.data.sourceTagId, parsed.data.targetTagId]
    );
    await client.query(`DELETE FROM resource_tags WHERE tag_id = $1`, [parsed.data.sourceTagId]);
    await client.query(`DELETE FROM tags WHERE id = $1`, [parsed.data.sourceTagId]);
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Failed to merge tags", {
      sourceTagId: parsed.data.sourceTagId,
      targetTagId: parsed.data.targetTagId,
      error: err instanceof Error ? err.message : String(err),
    });
    return { error: "Failed to merge tags" };
  } finally {
    client.release();
  }

  revalidateTags();
  return { success: true };
}
