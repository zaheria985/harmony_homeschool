import { NextRequest, NextResponse } from "next/server";
import { bumpOverdueLessonsForAllCore } from "@/lib/server/lesson-bump";
import { isAuthorizedCronRequest } from "@/lib/server/cron-auth";
import { todayKey } from "@/lib/utils/timezone";

/**
 * POST /api/cron/bump-lessons
 *
 * Moves overdue incomplete lessons forward for every child.
 *
 * Auth: CRON_SECRET via `x-cron-secret` or `Authorization: Bearer <secret>`.
 *
 * Responses:
 * - 200: { success: true, bumped }
 * - 401: { error: "Unauthorized" }
 * - 500: { error }
 *
 * POST only — this rewrites lesson dates, and a GET alias invites a prefetch,
 * crawler or link preview to reschedule the family's week.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
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
