"use server";

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

export async function addReadingEntry(formData: FormData) {
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

  const { resourceId, childId, date, pagesRead, minutesRead, notes } =
    data.data;

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
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteReadingEntry(entryId: string) {
  const parsed = z.string().uuid().safeParse(entryId);
  if (!parsed.success) return { error: "Invalid ID" };

  await pool.query("DELETE FROM reading_log WHERE id = $1", [parsed.data]);

  revalidatePath("/reading");
  revalidatePath("/dashboard");
  return { success: true };
}
