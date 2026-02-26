"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import pool from "@/lib/db";
import { saveUploadedImage } from "@/lib/server/uploads";
import { getCurrentUser } from "@/lib/session";
import { verifyParentOwnsChild } from "@/lib/permissions";

const nameSchema = z.string().min(1).max(100);

export async function createChild(formData: FormData) {
  const name = nameSchema.safeParse(formData.get("name"));
  const emoji = formData.get("emoji") as string | null;
  const uploadedBanner = formData.get("banner_file");
  if (!name.success) {
    return { error: "Name is required (max 100 characters)" };
  }

  const savedBanner = await saveUploadedImage(
    uploadedBanner instanceof File ? uploadedBanner : null,
    "children"
  );
  if (savedBanner && "error" in savedBanner) return savedBanner;

  const insertRes = await pool.query(
    "INSERT INTO children (name, emoji, banner_url) VALUES ($1, $2, $3) RETURNING id",
    [name.data, emoji || null, savedBanner?.path || null]
  );
  const childId = insertRes.rows[0]?.id as string | undefined;

  const user = await getCurrentUser();
  if (childId && user.role === "parent" && user.id) {
    await pool.query(
      "INSERT INTO parent_children (parent_id, child_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [user.id, childId]
    );
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateChild(formData: FormData) {
  const id = z.string().uuid().safeParse(formData.get("id"));
  const name = nameSchema.safeParse(formData.get("name"));
  const emoji = formData.get("emoji") as string | null;
  const bannerUrl = formData.get("banner_url") as string | null;
  const clearBanner = formData.get("clear_banner") === "true";
  const uploadedBanner = formData.get("banner_file");

  if (!id.success || !name.success) {
    return { error: "Invalid input" };
  }

  const savedBanner = await saveUploadedImage(
    uploadedBanner instanceof File ? uploadedBanner : null,
    "children"
  );
  if (savedBanner && "error" in savedBanner) return savedBanner;

  const nextBannerUrl = clearBanner
    ? null
    : savedBanner?.path || bannerUrl || null;

  try {
    await pool.query(
      "UPDATE children SET name = $1, emoji = $2, banner_url = $3 WHERE id = $4",
      [name.data, emoji || null, nextBannerUrl, id.data]
    );
  } catch (err) {
    console.error("Failed to update child", { id: id.data, error: err instanceof Error ? err.message : String(err) });
    return { error: "Failed to update child" };
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/week");
  return { success: true };
}

export async function deleteChild(childId: string) {
  const parsed = z.string().uuid().safeParse(childId);
  if (!parsed.success) return { error: "Invalid child ID" };

  const user = await getCurrentUser();
  if (user.role === "parent" && user.id) {
    const owns = await verifyParentOwnsChild(user.id, parsed.data);
    if (!owns) return { error: "Not authorized to delete this student" };
  }

  try {
    await pool.query("DELETE FROM children WHERE id = $1", [parsed.data]);
  } catch (err) {
    console.error("Failed to delete child", { childId: parsed.data, error: err instanceof Error ? err.message : String(err) });
    return { error: "Failed to delete child" };
  }

  revalidatePath("/students");
  revalidatePath("/dashboard");
  revalidatePath("/admin/children");
  return { success: true };
}
