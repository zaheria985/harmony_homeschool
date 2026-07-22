import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import pool from "./db";

function readStringField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * In-memory login throttle keyed by lowercased email.
 *
 * After MAX_ATTEMPTS consecutive failures, the key is locked for LOCK_MS.
 * A successful login clears the counter. This is a single-process limiter —
 * if Harmony is ever run behind multiple app instances, move this to a shared
 * store (Redis/Postgres) so the limit holds across processes.
 */
const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const loginAttempts = new Map<string, { count: number; lockedUntil: number }>();

function loginKey(email: string): string {
  return email.trim().toLowerCase();
}

function isLockedOut(email: string): boolean {
  const entry = loginAttempts.get(loginKey(email));
  if (!entry) return false;
  if (entry.lockedUntil > Date.now()) return true;
  if (entry.lockedUntil !== 0 && entry.lockedUntil <= Date.now()) {
    // Lock expired — reset.
    loginAttempts.delete(loginKey(email));
  }
  return false;
}

function recordFailure(email: string): void {
  const key = loginKey(email);
  const entry = loginAttempts.get(key) ?? { count: 0, lockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCK_MS;
  }
  loginAttempts.set(key, entry);
}

function recordSuccess(email: string): void {
  loginAttempts.delete(loginKey(email));
}

function readNullableStringField(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (value === null) return null;
  return null;
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Reject locked-out accounts before spending a bcrypt compare.
        if (isLockedOut(credentials.email)) return null;

        const result = await pool.query(
          "SELECT id, name, email, password_hash, role, child_id, permission_level FROM users WHERE email = $1",
          [credentials.email]
        );

        const user = result.rows[0];
        if (!user) {
          recordFailure(credentials.email);
          return null;
        }

        const valid = await compare(credentials.password, user.password_hash);
        if (!valid) {
          recordFailure(credentials.email);
          return null;
        }

        recordSuccess(credentials.email);
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          child_id: user.child_id,
          permission_level: user.permission_level,
        };
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const userRecord = user as unknown as Record<string, unknown>;
        token.role = readStringField(userRecord.role) || undefined;
        token.id = readStringField(userRecord.id) || undefined;
        token.child_id = readNullableStringField(userRecord.child_id);
        // Fail closed: an unknown permission level is the least privileged.
        token.permission_level = readStringField(userRecord.permission_level) || "view_only";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as {
          id?: string;
          role?: string;
          child_id?: string | null;
          permission_level?: string;
        };
        sessionUser.id = readStringField(token.id) || "";
        // Fail closed: never fabricate a parent role from a missing claim.
        // Downstream authz (lib/server/authz.ts) rejects an empty/unknown role.
        sessionUser.role = readStringField(token.role) || "";
        sessionUser.child_id = readNullableStringField(token.child_id);
        sessionUser.permission_level = readStringField(token.permission_level) || "view_only";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
