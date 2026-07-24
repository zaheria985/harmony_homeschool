import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

function safeSecretEqual(provided: string, expected: string) {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(providedBuffer, expectedBuffer);
}

/**
 * Authorize a scheduled request against CRON_SECRET.
 *
 * Accepts the secret as `x-cron-secret` or `Authorization: Bearer <secret>`.
 * Fails closed: no configured secret means no scheduled runs, rather than an
 * open endpoint that mutates every family's lesson dates.
 */
export function isAuthorizedCronRequest(request: NextRequest): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return false;

  const headerSecret = request.headers.get("x-cron-secret") || "";
  const authHeader = request.headers.get("authorization") || "";
  const bearerSecret = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7)
    : "";
  const candidate = headerSecret || bearerSecret;
  if (!candidate) return false;

  return safeSecretEqual(candidate, expectedSecret);
}
