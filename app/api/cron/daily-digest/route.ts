import { NextRequest, NextResponse } from "next/server";
import { buildDailyDigest } from "@/lib/server/daily-digest";
import { isAuthorizedCronRequest } from "@/lib/server/cron-auth";
import { todayKey } from "@/lib/utils/timezone";

/**
 * POST /api/cron/daily-digest
 *
 * Auth: CRON_SECRET via `x-cron-secret` or `Authorization: Bearer <secret>`,
 * matching /api/cron/bump-lessons.
 *
 * Builds a "what's due today" summary and, when HA_WEBHOOK_URL is set, POSTs
 * it there. With no webhook configured it still returns the payload, so the
 * endpoint doubles as a preview.
 *
 * Pass ?dry=1 to build the payload without sending it.
 *
 * POST only: this sends a notification, so a GET alias would let any prefetch
 * or link preview fire the digest.
 */
export async function POST(request: NextRequest) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dryRun = request.nextUrl.searchParams.get("dry") === "1";

  let digest;
  try {
    digest = await buildDailyDigest(todayKey());
  } catch (err) {
    console.error("[cron/daily-digest] failed to build digest", err);
    return NextResponse.json({ error: "Digest failed" }, { status: 500 });
  }

  const webhookUrl = process.env.HA_WEBHOOK_URL;
  if (!webhookUrl || dryRun) {
    return NextResponse.json({
      success: true,
      delivered: false,
      reason: dryRun ? "dry run" : "HA_WEBHOOK_URL not set",
      digest,
    });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(digest),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      console.warn("[cron/daily-digest] webhook rejected", response.status);
      // The digest itself succeeded, so report partial success rather than 500.
      return NextResponse.json({
        success: true,
        delivered: false,
        reason: `webhook responded ${response.status}`,
        digest,
      });
    }
  } catch (err) {
    console.warn("[cron/daily-digest] webhook post failed", err);
    return NextResponse.json({
      success: true,
      delivered: false,
      reason: "webhook unreachable",
      digest,
    });
  }

  return NextResponse.json({ success: true, delivered: true, digest });
}
