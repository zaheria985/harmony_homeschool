import { timingSafeEqual } from "node:crypto";
import pool from "@/lib/db";

/**
 * Public signup is off by default.
 *
 * The one exception is bootstrapping: when the `users` table is empty a fresh
 * install has no other way to create its first parent account, so signup is
 * allowed until that account exists.
 */
export async function signupAvailability(): Promise<{
  allowed: boolean;
  requiresInviteCode: boolean;
  reason: "enabled" | "bootstrap" | "disabled";
}> {
  if (process.env.SIGNUP_ENABLED === "true") {
    return {
      allowed: true,
      requiresInviteCode: Boolean(process.env.SIGNUP_INVITE_CODE),
      reason: "enabled",
    };
  }

  try {
    const res = await pool.query("SELECT 1 FROM users LIMIT 1");
    if (res.rowCount === 0) {
      return { allowed: true, requiresInviteCode: false, reason: "bootstrap" };
    }
  } catch {
    // If we cannot prove the instance is empty, refuse.
    return { allowed: false, requiresInviteCode: false, reason: "disabled" };
  }

  return { allowed: false, requiresInviteCode: false, reason: "disabled" };
}

export function inviteCodeMatches(supplied: string | undefined): boolean {
  const expected = process.env.SIGNUP_INVITE_CODE;
  if (!expected) return true;
  if (!supplied) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
