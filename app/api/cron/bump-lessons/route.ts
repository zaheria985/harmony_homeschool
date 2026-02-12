import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { bumpOverdueLessonsForAll } from "@/lib/actions/lessons";
function todayDateKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function safeSecretEqual(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
} /** * POST /api/cron/bump-lessons * * Auth: * - Requires CRON_SECRET via either: * - x-cron-secret header, or * - Authorization: Bearer <secret> * * Responses: * - 200: { success: true, bumped } * - 401: { error:"Unauthorized" } * - 500: { error } */
export async function POST(request: NextRequest) {
  const expectedSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("x-cron-secret") || "";
  const authHeader = request.headers.get("authorization") || "";
  const bearerSecret = authHeader.startsWith("Bearer")
    ? authHeader.slice(7)
    : "";
  const secretCandidate = providedSecret || bearerSecret;
  if (
    !expectedSecret ||
    !secretCandidate ||
    !safeSecretEqual(secretCandidate, expectedSecret)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await bumpOverdueLessonsForAll(todayDateKey(), true);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }
  return NextResponse.json({ success: true, bumped: result.bumped });
}
export async function GET(request: NextRequest) {
  return POST(request);
}
