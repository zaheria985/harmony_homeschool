"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { PoolClient } from "pg";
import pool from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { parseImportedDates } from "@/lib/utils/recurrence";

const recurrenceSchema = z.enum(["once", "weekly", "biweekly", "monthly"]);

const categorySchema = z.enum(["co-op", "sport", "music", "art", "field-trip", "other"]);

const createSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().optional(),
  category: categorySchema.default("other"),
  recurrence_type: recurrenceSchema.optional(),
  day_of_week: z.coerce.number().min(0).max(6).optional(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  all_day: z.string().optional(),
  color: z.string().default("#3b82f6"),
  child_ids: z.array(z.string().uuid()).min(1, "Select at least one student"),
  pasted_dates: z.string().optional(),
});

const updateSchema = createSchema.extend({
  id: z.string().uuid(),
  recurrence_type: recurrenceSchema,
  start_date: z.string().min(1, "Start date is required"),
});

async function ensureAdmin() {
  const user = await getCurrentUser();
  if (user.role === "kid") return { error: "Students cannot manage external events" };
  return null;
}

function normalizedDates(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function replaceChildren(client: PoolClient, eventId: string, childIds: string[]) {
  await client.query("DELETE FROM external_event_children WHERE external_event_id = $1", [eventId]);
  for (const childId of childIds) {
    await client.query(
      `INSERT INTO external_event_children (external_event_id, child_id)
       VALUES ($1, $2)
       ON CONFLICT (external_event_id, child_id) DO NOTHING`,
      [eventId, childId]
    );
  }
}

async function replaceExceptions(client: PoolClient, eventId: string, dates: string[], reason: string | null = null) {
  await client.query("DELETE FROM external_event_exceptions WHERE external_event_id = $1", [eventId]);
  for (const date of dates) {
    await client.query(
      `INSERT INTO external_event_exceptions (external_event_id, exception_date, reason)
       VALUES ($1, $2::date, $3)
       ON CONFLICT (external_event_id, exception_date) DO UPDATE SET reason = EXCLUDED.reason`,
      [eventId, date, reason]
    );
  }
}

export async function createExternalEvent(formData: FormData) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const data = createSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || "other",
    recurrence_type: formData.get("recurrence_type") || undefined,
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date") || undefined,
    end_date: formData.get("end_date") || undefined,
    start_time: formData.get("start_time") || undefined,
    end_time: formData.get("end_time") || undefined,
    all_day: formData.get("all_day") || undefined,
    color: formData.get("color") || "#3b82f6",
    child_ids: formData.getAll("child_ids"),
    pasted_dates: formData.get("pasted_dates") || undefined,
  });

  if (!data.success) {
    return { error: data.error.issues[0]?.message || "Invalid input" };
  }

  const pastedDates = (data.data.pasted_dates || "").trim();
  let recurrenceType = data.data.recurrence_type || "weekly";
  let dayOfWeek: number | null = data.data.day_of_week ?? null;
  let startDate = data.data.start_date || "";
  let endDate = data.data.end_date || null;
  let exceptionDates: string[] = [];

  if (pastedDates) {
    const parsed = parseImportedDates(pastedDates);
    if ("error" in parsed) return parsed;

    recurrenceType = parsed.recurrenceType;
    dayOfWeek = parsed.dayOfWeek;
    startDate = parsed.startDate;
    endDate = parsed.endDate;
    exceptionDates = parsed.impliedExceptionDates;
  }

  if (!startDate) {
    return { error: "Start date is required" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const created = await client.query(
      `INSERT INTO external_events (
        title,
        description,
        category,
        recurrence_type,
        day_of_week,
        start_date,
        end_date,
        start_time,
        end_time,
        all_day,
        color
      ) VALUES ($1, $2, $3, $4, $5, $6::date, $7::date, $8::time, $9::time, $10, $11)
      RETURNING id`,
      [
        data.data.title.trim(),
        data.data.description?.trim() || null,
        data.data.category,
        recurrenceType,
        dayOfWeek,
        startDate,
        endDate,
        data.data.start_time || null,
        data.data.end_time || null,
        data.data.all_day === "true",
        data.data.color,
      ]
    );

    const eventId = created.rows[0].id as string;
    for (const childId of data.data.child_ids) {
      await client.query(
        `INSERT INTO external_event_children (external_event_id, child_id)
         VALUES ($1, $2)`,
        [eventId, childId]
      );
    }
    for (const date of exceptionDates) {
      await client.query(
        `INSERT INTO external_event_exceptions (external_event_id, exception_date, reason)
         VALUES ($1, $2::date, $3)`,
        [eventId, date, "Not in imported schedule"]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to create external event", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "Failed to create external event" };
  } finally {
    client.release();
  }

  revalidatePath("/admin/external-events");
  revalidatePath("/calendar");
  revalidatePath("/week");
  return { success: true };
}

export async function updateExternalEvent(formData: FormData) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const data = updateSchema.safeParse({
    id: formData.get("id"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    category: formData.get("category") || "other",
    recurrence_type: formData.get("recurrence_type"),
    day_of_week: formData.get("day_of_week") || undefined,
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date") || undefined,
    start_time: formData.get("start_time") || undefined,
    end_time: formData.get("end_time") || undefined,
    all_day: formData.get("all_day") || undefined,
    color: formData.get("color") || "#3b82f6",
    child_ids: formData.getAll("child_ids"),
    pasted_dates: undefined,
  });

  if (!data.success) {
    return { error: data.error.issues[0]?.message || "Invalid input" };
  }

  const exceptionDates = normalizedDates(String(formData.get("exception_dates") || ""));
  const exceptionReason = String(formData.get("exception_reason") || "").trim() || null;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE external_events
       SET title = $1,
           description = $2,
           category = $3,
           recurrence_type = $4,
           day_of_week = $5,
           start_date = $6::date,
           end_date = $7::date,
           start_time = $8::time,
           end_time = $9::time,
           all_day = $10,
           color = $11
       WHERE id = $12`,
      [
        data.data.title.trim(),
        data.data.description?.trim() || null,
        data.data.category,
        data.data.recurrence_type,
        data.data.day_of_week ?? null,
        data.data.start_date,
        data.data.end_date || null,
        data.data.start_time || null,
        data.data.end_time || null,
        data.data.all_day === "true",
        data.data.color,
        data.data.id,
      ]
    );

    await replaceChildren(client, data.data.id, data.data.child_ids);
    await replaceExceptions(client, data.data.id, exceptionDates, exceptionReason);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Failed to update external event", {
      eventId: data.data.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "Failed to update external event" };
  } finally {
    client.release();
  }

  revalidatePath("/admin/external-events");
  revalidatePath("/calendar");
  revalidatePath("/week");
  return { success: true };
}

export async function deleteExternalEvent(id: string) {
  const denied = await ensureAdmin();
  if (denied) return denied;

  const parsed = z.string().uuid().safeParse(id);
  if (!parsed.success) return { error: "Invalid event ID" };

  try {
    await pool.query(`DELETE FROM external_events WHERE id = $1`, [parsed.data]);
  } catch (error) {
    console.error("Failed to delete external event", {
      eventId: parsed.data,
      error: error instanceof Error ? error.message : String(error),
    });
    return { error: "Failed to delete external event" };
  }

  revalidatePath("/admin/external-events");
  revalidatePath("/calendar");
  revalidatePath("/week");
  return { success: true };
}

export async function previewImportedExternalDates(raw: string) {
  const denied = await ensureAdmin();
  if (denied) return denied;
  return parseImportedDates(raw);
}
