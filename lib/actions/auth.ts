"use server";

import { requireParent, requireUser } from "@/lib/server/authz";
import { recordAudit } from "@/lib/server/audit";
import { signupAvailability, inviteCodeMatches } from "@/lib/server/signup-policy";
import { z } from "zod";
import { hash, compare } from "bcryptjs";
import pool from "@/lib/db";
import { revalidatePath } from "next/cache";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  inviteCode: z.string().optional(),
});

export async function signupUser(formData: FormData) {
  const availability = await signupAvailability();
  if (!availability.allowed) {
    return { error: "Signup is disabled on this instance." };
  }

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: formData.get("inviteCode") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  // The very first account bootstraps the instance and needs no invite code.
  if (availability.requiresInviteCode && !inviteCodeMatches(parsed.data.inviteCode)) {
    return { error: "Invalid invite code" };
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
  permissionLevel: z.enum(["full", "mark_complete", "view_only"]).default("full"),
});

export async function createKidAccount(formData: FormData) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = createKidSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    childId: formData.get("childId"),
    permissionLevel: formData.get("permissionLevel") || "full",
  });

  if (!parsed.success) {
    return { error: parsed.error.errors[0].message };
  }

  const { email, password, childId, permissionLevel } = parsed.data;

  // Verify child exists
  const childRes = await pool.query("SELECT id, name FROM children WHERE id = $1", [childId]);
  if (childRes.rows.length === 0) {
    return { error: "Child not found" };
  }

  const passwordHash = await hash(password, 10);
  const childName = childRes.rows[0].name;

  try {
    await pool.query(
      "INSERT INTO users (name, email, password_hash, role, child_id, permission_level) VALUES ($1, $2, $3, 'kid', $4, $5)",
      [childName, email, passwordHash, childId, permissionLevel]
    );
  } catch (err: unknown) {
    const pgErr = err as { code?: string };
    if (pgErr.code === "23505") {
      return { error: "Email already registered" };
    }
    throw err;
  }

  await recordAudit({
    actorUserId: _authUser.id,
    action: "create_kid_account",
    entityType: "user",
    detail: { email, childId, permissionLevel },
  });

  revalidatePath("/settings/users");
  return { success: true };
}

const updateEmailSchema = z.object({
  newEmail: z.string().email("Invalid email"),
  currentPassword: z.string().min(1, "Current password is required"),
});

export async function updateEmail(formData: FormData) {
  // Self-service: any signed-in user may change their own email.
  const _authUser = await requireUser();
  if (!_authUser) return { error: "Unauthorized" };
  const userId = _authUser.id;

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
  // Self-service: any signed-in user may change their own password.
  const _authUser = await requireUser();
  if (!_authUser) return { error: "Unauthorized" };
  const userId = _authUser.id;

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

const updatePermissionSchema = z.object({
  userId: z.string().uuid(),
  permissionLevel: z.enum(["full", "mark_complete", "view_only"]),
});

export async function updateKidPermission(userId: string, permissionLevel: string) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = updatePermissionSchema.safeParse({ userId, permissionLevel });
  if (!parsed.success) return { error: "Invalid input" };

  const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [parsed.data.userId]);
  if (userRes.rows.length === 0) return { error: "User not found" };
  if (userRes.rows[0].role !== "kid") return { error: "Can only update kid accounts" };

  await pool.query(
    "UPDATE users SET permission_level = $1 WHERE id = $2",
    [parsed.data.permissionLevel, parsed.data.userId]
  );

  await recordAudit({
    actorUserId: _authUser.id,
    action: "update_kid_permission",
    entityType: "user",
    entityId: parsed.data.userId,
    detail: { permissionLevel: parsed.data.permissionLevel },
  });

  revalidatePath("/settings/users");
  return { success: true };
}

const resetPasswordSchema = z.object({
  userId: z.string().uuid(),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export async function resetKidPassword(userId: string, newPassword: string) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  const parsed = resetPasswordSchema.safeParse({ userId, newPassword });
  if (!parsed.success) return { error: parsed.error.errors[0].message };

  const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [parsed.data.userId]);
  if (userRes.rows.length === 0) return { error: "User not found" };
  if (userRes.rows[0].role !== "kid") return { error: "Can only reset kid account passwords" };

  const passwordHash = await hash(parsed.data.newPassword, 10);
  await pool.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
    passwordHash,
    parsed.data.userId,
  ]);

  await recordAudit({
    actorUserId: _authUser.id,
    action: "reset_kid_password",
    entityType: "user",
    entityId: parsed.data.userId,
  });

  revalidatePath("/settings/users");
  return { success: true };
}

export async function deleteKidAccount(userId: string) {
  const _authUser = await requireParent();
  if (!_authUser) return { error: "Unauthorized" };
  // Verify target is a kid account
  const userRes = await pool.query("SELECT role FROM users WHERE id = $1", [userId]);
  if (userRes.rows.length === 0) {
    return { error: "User not found" };
  }
  if (userRes.rows[0].role !== "kid") {
    return { error: "Can only delete kid accounts" };
  }

  await pool.query("DELETE FROM users WHERE id = $1", [userId]);

  await recordAudit({
    actorUserId: _authUser.id,
    action: "delete_kid_account",
    entityType: "user",
    entityId: userId,
  });

  revalidatePath("/settings/users");
  return { success: true };
}
