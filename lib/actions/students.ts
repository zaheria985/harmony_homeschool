"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";

const nameSchema = z.string().min(1).max(100);

export async function createChild(formData: FormData) {
  const name = nameSchema.safeParse(formData.get("name"));
  if (!name.success) {
    return { error: "Name is required (max 100 characters)" };
  }

  await pool.query("INSERT INTO children (name) VALUES ($1)", [name.data]);

  revalidatePath("/students");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateChild(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const name = nameSchema.safeParse(formData.get("name"));

  if (!id.success || !name.success) {
    return { error: "Invalid input" };
  }

  await pool.query("UPDATE children SET name = $1 WHERE id = $2", [
    name.data,
    id.data,
  ]);

  revalidatePath("/students");
  return { success: true };
}

export async function deleteChild(childId: string) {
  const parsed = z.string().uuid().safeParse(childId);
  if (!parsed.success) return { error: "Invalid child ID" };

  await pool.query("DELETE FROM children WHERE id = $1", [parsed.data]);

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/admin/children");
  return { success: true };
}
