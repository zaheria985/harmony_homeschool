import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { bumpOverdueLessonsForAllCore } from "@/lib/server/lesson-bump";
import { todayKey } from "@/lib/utils/timezone";
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
  // Authorized by CRON_SECRET above; call the core directly since there is
  // no user session on a scheduled run.
  try {
    const bumped = await bumpOverdueLessonsForAllCore(todayKey(), true);
    return NextResponse.json({ success: true, bumped });
  } catch (err) {
    console.error("[cron/bump-lessons] failed", err);
    return NextResponse.json({ error: "Bump failed" }, { status: 500 });
  }
}
export async function GET(request: NextRequest) {
  return POST(request);
}
