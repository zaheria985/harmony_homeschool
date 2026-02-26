"use server";

import { z } from "zod";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

const ImportSchema = z.object({
  type: z.enum(["lessons", "books"]),
  data: z.string().min(1, "No data provided"),
  childId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  curriculumName: z.string().optional(),
});

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split("\n");
  if (lines.length < 2) return [];

  // Detect delimiter: tab or comma
  const delimiter = lines[0].includes("\t") ? "\t" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim().toLowerCase().replace(/^"/, "").replace(/"$/, ""));

  return lines.slice(1).map((line) => {
    // Simple CSV split handling quoted fields
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter.charAt(0) && !inQuotes) {
        values.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    values.push(current.trim());

    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = values[i]?.trim() || "";
    });
    return obj;
  });
}

function parseJSON(text: string): Record<string, string>[] {
  const parsed = JSON.parse(text);
  const arr = Array.isArray(parsed) ? parsed : [parsed];
  return arr.map((item) => {
    const obj: Record<string, string> = {};
    for (const [key, val] of Object.entries(item)) {
      obj[key.toLowerCase()] = String(val ?? "");
    }
    return obj;
  });
}

function detectFormat(text: string): "csv" | "json" {
  const trimmed = text.trim();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) return "json";
  return "csv";
}

export async function importFromPlatform(formData: FormData) {
  const raw = {
    type: formData.get("type") as string,
    data: formData.get("data") as string,
    childId: (formData.get("childId") as string) || undefined,
    subjectId: (formData.get("subjectId") as string) || undefined,
    curriculumName: (formData.get("curriculumName") as string) || undefined,
  };

  const parsed = ImportSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.errors[0]?.message || "Invalid input" };
  }

  const { type, data, childId, subjectId, curriculumName } = parsed.data;

  let rows: Record<string, string>[];
  try {
    const format = detectFormat(data);
    rows = format === "json" ? parseJSON(data) : parseCSV(data);
  } catch {
    return { error: "Failed to parse data. Check the format and try again." };
  }

  if (rows.length === 0) {
    return { error: "No data rows found. Ensure headers and at least one row." };
  }

  let imported = 0;

  if (type === "lessons") {
    if (!childId || !subjectId) {
      return { error: "Child and Subject are required for lesson import." };
    }

    const name = curriculumName || "Imported Lessons";

    // Create curriculum
    const curRes = await pool.query(
      `INSERT INTO curricula (name, subject_id) VALUES ($1, $2) RETURNING id`,
      [name, subjectId]
    );
    const curriculumId = curRes.rows[0].id;

    // Assign to child via active school year
    const yearRes = await pool.query(
      `SELECT id FROM school_years WHERE is_active = true LIMIT 1`
    );
    if (yearRes.rows[0]) {
      await pool.query(
        `INSERT INTO curriculum_assignments (curriculum_id, child_id, school_year_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [curriculumId, childId, yearRes.rows[0].id]
      );
    }

    for (const row of rows) {
      const title = row.title || row.name || row.lesson;
      if (!title) continue;

      const status = row.status || "planned";
      const validStatus = ["planned", "in_progress", "completed"].includes(status)
        ? status
        : "planned";

      await pool.query(
        `INSERT INTO lessons (title, description, scheduled_date, status, curriculum_id, order_index)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          title,
          row.description || null,
          row.date || null,
          validStatus,
          curriculumId,
          imported,
        ]
      );
      imported++;
    }
  } else if (type === "books") {
    for (const row of rows) {
      const title = row.title || row.name;
      if (!title) continue;

      await pool.query(
        `INSERT INTO books (title, author, isbn, status)
         VALUES ($1, $2, $3, 'wishlist')
         ON CONFLICT DO NOTHING`,
        [title, row.author || null, row.isbn || null]
      );
      imported++;
    }
  }

  revalidatePath("/admin");
  revalidatePath("/curricula");
  revalidatePath("/booklists");

  return { success: true, imported };
}
