"use server";

import { z } from "zod";
import { hash, compare } from "bcryptjs";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function signupUser(formData: FormData) {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hash(password, 10);

  try {
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'parent')",
      [name, email, passwordHash]
    );
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return { error: "Email already registered" };
    }
    throw err;
  }

  return { success: true };
}

const createKidSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  childId: z.string().uuid("Invalid child"),
});

export async function createKidAccount(formData: FormData) {
  const parsed = createKidSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    childId: formData.get("childId"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { email, password, childId } = parsed.data;

  // Verify child exists
  const childRes = await pool.query("SELECT id, name FROM children WHERE id = $1", [childId]);
  if (childRes.rows.length === 0) {
    return { error: "Child not found" };
  }

  const passwordHash = await hash(password, 10);
  const childName = childRes.rows[0].name;

  try {
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, child_id) VALUES ($1, $2, $3, 'kid', $4)",
      [childName, email, passwordHash, childId]
    );
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return { error: "Email already registered" };
    }
    throw err;
  }

  revalidatePath("/settings/users");
  return { success: true };
}

const updateEmailSchema = z.object({
  newEmail: z.string().email("Invalid email"),
  currentPassword: z.string().min(1, "Current password is required"),
});

export async function updateEmail(formData: FormData) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: "Not authenticated" };

  const parsed = updateEmailSchema.safeParse({
    newEmail: formData.get("newEmail"),
    currentPassword: formData.get("currentPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { newEmail, currentPassword } = parsed.data;

  const userRes = await pool.query(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId]
  );
  if (userRes.rows.length === 0) return { error: "User not found" };

  const valid = await compare(currentPassword, userRes.rows[0].password_hash);
  if (!valid) return { error: "Incorrect password" };

  try {
    await pool.query("UPDATE users SET email = $1 WHERE id = $2", [
      newEmail,
      userId,
    ]);
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return { error: "Email already in use" };
    }
    throw err;
  }

  revalidatePath("/settings/account");
  return { success: true };
}

const updatePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Please confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export async function updatePassword(formData: FormData) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return { error: "Not authenticated" };

  const parsed = updatePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { currentPassword, newPassword } = parsed.data;

  const userRes = await pool.query(
    "SELECT password_hash FROM users WHERE id = $1",
    [userId]
  );
  if (userRes.rows.length === 0) return { error: "User not found" };

  const valid = await compare(currentPassword, userRes.rows[0].password_hash);
  if (!valid) return { error: "Incorrect password" };

  const newHash = await hash(newPassword, 10);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    newHash,
    userId,
  ]);

  revalidatePath("/settings/account");
  return { success: true };
}

export async function deleteKidAccount(userId: string) {
  // Verify target is a kid account
  const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
  if (userRes.rows.length === 0) {
    return { error: "User not found" };
  }
  if (userRes.rows[0].role !== "kid") {
    return { error: "Can only delete kid accounts" };
  }

  await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  revalidatePath("/settings/users");
  return { success: true };
}
