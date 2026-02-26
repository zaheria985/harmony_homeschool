"use server";

import { z } from "zod";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

const saveSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  content: z.string(),
});

export async function saveWeeklyNote(weekStart: string, content: string) {
  const parsed = saveSchema.safeParse({ weekStart, content });
  if (!parsed.success) return { error: "Invalid input" };

  await pool.query(
    `INSERT INTO weekly_notes (week_start, content, updated_at)
     VALUES ($1::date, $2, now())
     ON CONFLICT (week_start)
     DO UPDATE SET content = EXCLUDED.content, updated_at = now()`,
    [parsed.data.weekStart, parsed.data.content]
  );

  revalidatePath("/week");
  return { success: true };
}

export async function getWeeklyNotes(weekStarts: string[]): Promise<Record<string, string>> {
  if (weekStarts.length === 0) return {};
  const placeholders = weekStarts.map((_, i) => `$${i + 1}::date`).join(",");
  const res = await pool.query(
    `SELECT week_start::text, content FROM weekly_notes WHERE week_start IN (${placeholders})`,
    weekStarts
  );
  const notes: Record<string, string> = {};
  for (const row of res.rows) {
    notes[row.week_start] = row.content;
  }
  return notes;
}
