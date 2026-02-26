"use server";

import { z } from "zod";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

// ── Schemas ──────────────────────────────────────────────────────────────

const ThresholdSchema = z.object({
  letter: z.string().min(1).max(5),
  min_score: z.number().min(0).max(999.99),
  color: z.string().nullable().optional(),
});

const CreateScaleSchema = z.object({
  name: z.string().min(1).max(100),
  thresholds: z.array(ThresholdSchema).min(1),
});

const UpdateScaleSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  thresholds: z.array(ThresholdSchema).min(1),
});

const IdSchema = z.object({
  id: z.string().uuid(),
});

// ── Types ────────────────────────────────────────────────────────────────

export type GradeThreshold = {
  id: string;
  scale_id: string;
  letter: string;
  min_score: number;
  color: string | null;
};

export type GradingScale = {
  id: string;
  name: string;
  is_default: boolean;
  created_at: string;
  thresholds: GradeThreshold[];
};

// ── Queries ──────────────────────────────────────────────────────────────

export async function getGradingScales(): Promise<GradingScale[]> {
  const scalesRes = await pool.query(
    `SELECT id, name, is_default, created_at FROM grading_scales ORDER BY is_default DESC, name`
  );

  const scales: GradingScale[] = [];
  for (const scale of scalesRes.rows) {
    const thresholdsRes = await pool.query(
      `SELECT id, scale_id, letter, min_score, color
       FROM grade_thresholds
       WHERE scale_id = $1
       ORDER BY min_score DESC`,
      [scale.id]
    );
    scales.push({
      ...scale,
      min_score: undefined,
      thresholds: thresholdsRes.rows.map((t: Record<string, unknown>) => ({
        ...t,
        min_score: Number(t.min_score),
      })),
    });
  }

  return scales;
}

export async function getDefaultScaleThresholds(): Promise<GradeThreshold[]> {
  const res = await pool.query(
    `SELECT gt.id, gt.scale_id, gt.letter, gt.min_score, gt.color
     FROM grade_thresholds gt
     JOIN grading_scales gs ON gs.id = gt.scale_id
     WHERE gs.is_default = true
     ORDER BY gt.min_score DESC`
  );
  return res.rows.map((t: Record<string, unknown>) => ({
    ...t,
    min_score: Number(t.min_score),
  })) as GradeThreshold[];
}

// ── Mutations ────────────────────────────────────────────────────────────

export async function createGradingScale(formData: FormData) {
  const raw = {
    name: formData.get("name"),
    thresholds: JSON.parse(formData.get("thresholds") as string || "[]"),
  };
  const parsed = CreateScaleSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid data: " + parsed.error.message };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const scaleRes = await client.query(
      `INSERT INTO grading_scales (name) VALUES ($1) RETURNING id`,
      [parsed.data.name]
    );
    const scaleId = scaleRes.rows[0].id;

    for (const t of parsed.data.thresholds) {
      await client.query(
        `INSERT INTO grade_thresholds (scale_id, letter, min_score, color)
         VALUES ($1, $2, $3, $4)`,
        [scaleId, t.letter, t.min_score, t.color || null]
      );
    }

    await client.query("COMMIT");
    revalidatePath("/settings");
    revalidatePath("/grades");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    return { error: "Failed to create grading scale" };
  } finally {
    client.release();
  }
}

export async function updateGradingScale(formData: FormData) {
  const raw = {
    id: formData.get("id"),
    name: formData.get("name"),
    thresholds: JSON.parse(formData.get("thresholds") as string || "[]"),
  };
  const parsed = UpdateScaleSchema.safeParse(raw);
  if (!parsed.success) return { error: "Invalid data: " + parsed.error.message };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `UPDATE grading_scales SET name = $1 WHERE id = $2`,
      [parsed.data.name, parsed.data.id]
    );

    // Delete existing thresholds and re-insert
    await client.query(
      `DELETE FROM grade_thresholds WHERE scale_id = $1`,
      [parsed.data.id]
    );

    for (const t of parsed.data.thresholds) {
      await client.query(
        `INSERT INTO grade_thresholds (scale_id, letter, min_score, color)
         VALUES ($1, $2, $3, $4)`,
        [parsed.data.id, t.letter, t.min_score, t.color || null]
      );
    }

    await client.query("COMMIT");
    revalidatePath("/settings");
    revalidatePath("/grades");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    return { error: "Failed to update grading scale" };
  } finally {
    client.release();
  }
}

export async function deleteGradingScale(formData: FormData) {
  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid scale ID" };

  // Check if it's the default
  const checkRes = await pool.query(
    `SELECT is_default FROM grading_scales WHERE id = $1`,
    [parsed.data.id]
  );
  if (checkRes.rows.length === 0) return { error: "Scale not found" };
  if (checkRes.rows[0].is_default) return { error: "Cannot delete the default scale" };

  await pool.query(`DELETE FROM grading_scales WHERE id = $1`, [parsed.data.id]);

  revalidatePath("/settings");
  revalidatePath("/grades");
  return { success: true };
}

export async function setDefaultScale(formData: FormData) {
  const parsed = IdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) return { error: "Invalid scale ID" };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`UPDATE grading_scales SET is_default = false WHERE is_default = true`);
    await client.query(`UPDATE grading_scales SET is_default = true WHERE id = $1`, [parsed.data.id]);
    await client.query("COMMIT");

    revalidatePath("/settings");
    revalidatePath("/grades");
    return { success: true };
  } catch (err) {
    await client.query("ROLLBACK");
    return { error: "Failed to set default scale" };
  } finally {
    client.release();
  }
}

