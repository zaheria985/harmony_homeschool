import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import pool from "./db";

function readStringField(value: unknown): string | null {
  return typeof value === "string" ? value : null;
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

        const result = await pool.query(
          "SELECT id, name, email, password_hash, role, child_id FROM users WHERE email = $1",
          [credentials.email]
        );

        const user = result.rows[0];
        if (!user) return null;

        const valid = await compare(credentials.password, user.password_hash);
        if (!valid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          child_id: user.child_id,
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const sessionUser = session.user as {
          id?: string;
          role?: string;
          child_id?: string | null;
        };
        sessionUser.id = readStringField(token.id) || "";
        sessionUser.role = readStringField(token.role) || "parent";
        sessionUser.child_id = readNullableStringField(token.child_id);
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
};
