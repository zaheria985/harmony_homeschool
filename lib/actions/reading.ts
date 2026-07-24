"use server";

import { requireUser, scopedChildId } from "@/lib/server/authz";
import { z } from "zod";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

const addEntrySchema = z.object({
  resourceId: z.string().uuid(),
  childId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  pagesRead: z.coerce.number().int().min(0).optional(),
  minutesRead: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
});

/**
 * Kids log their own reading.
 *
 * Reading is the one record a child keeps about themselves, and routing it
 * through a parent is why the log sat empty. A kid may only ever write against
 * their own student record — the submitted childId is not trusted — and
 * view_only accounts still cannot write.
 */
export async function addReadingEntry(formData: FormData) {
  const currentUser = await requireUser();
  if (!currentUser) return { error: "Unauthorized" };
  if (currentUser.permissionLevel === "view_only") {
    return { error: "You do not have permission to log reading" };
  }

  const data = addEntrySchema.safeParse({
    resourceId: formData.get("resourceId"),
    childId: formData.get("childId"),
    date: formData.get("date"),
    pagesRead: formData.get("pagesRead") || undefined,
    minutesRead: formData.get("minutesRead") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!data.success)
    return { error: data.error.issues[0]?.message || "Invalid input" };

  const { resourceId, date, pagesRead, minutesRead, notes } = data.data;

  const childId = scopedChildId(currentUser, data.data.childId);
  if (!childId) return { error: "No student is linked to this account" };

  await pool.query(
    `INSERT INTO reading_log (resource_id, child_id, date, pages_read, minutes_read, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      resourceId,
      childId,
      date,
      pagesRead ?? null,
      minutesRead ?? null,
      notes ?? null,
    ]
  );

  revalidatePath("/reading");
  revalidatePath("/today");
  return { success: true };
}

export async function deleteReadingEntry(entryId: string) {
  const currentUser = await requireUser();
  if (!currentUser) return { error: "Unauthorized" };
  if (currentUser.permissionLevel === "view_only") {
    return { error: "You do not have permission to change the reading log" };
  }
  const parsed = z.string().uuid().safeParse(entryId);
  if (!parsed.success) return { error: "Invalid ID" };

  // A kid can undo their own entry, never anyone else's.
  if (currentUser.role === "kid") {
    if (!currentUser.childId) return { error: "No student is linked to this account" };
    await pool.query("DELETE FROM reading_log WHERE id = $1 AND child_id = $2", [
      parsed.data,
      currentUser.childId,
    ]);
  } else {
    await pool.query("DELETE FROM reading_log WHERE id = $1", [parsed.data]);
  }

  revalidatePath("/reading");
  revalidatePath("/today");
  return { success: true };
}
