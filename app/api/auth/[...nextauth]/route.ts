import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth"; /** * NextAuth route handler. * * Endpoints: * - GET /api/auth/* * - POST /api/auth/* * * Auth behavior is configured in lib/auth.ts. */
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
