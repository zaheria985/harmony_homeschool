/**
 * Server-side "what day is it right now".
 *
 * The app has two date modules that were each internally consistent but
 * disagreed with one another: lib/utils/dates.ts works in the server's local
 * time, lib/utils/school-dates.ts works in UTC. That only matters where "now"
 * enters the system — a container running UTC would roll over to tomorrow at
 * 19:00 for an America/Chicago family, bumping lessons a day early.
 *
 * All *server-side* code that needs today's date must go through here.
 * Client components should keep using the browser's local time, which is
 * already the family's timezone; set APP_TIMEZONE to that same zone so the
 * two agree.
 */

export const DEFAULT_APP_TIMEZONE = "America/Chicago";

export function appTimeZone(): string {
  const configured = process.env.APP_TIMEZONE?.trim();
  if (!configured) return DEFAULT_APP_TIMEZONE;

  // A bad TZ name would make Intl throw on every call; fall back instead.
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: configured });
    return configured;
  } catch {
    console.warn(
      `[timezone] APP_TIMEZONE="${configured}" is not a valid IANA zone; using ${DEFAULT_APP_TIMEZONE}`
    );
    return DEFAULT_APP_TIMEZONE;
  }
}

/**
 * Format an instant as a YYYY-MM-DD key in the given IANA timezone.
 * en-CA gives ISO-ordered parts, so no manual reassembly is needed.
 */
export function dateKeyInTimeZone(instant: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** Today's YYYY-MM-DD key in the configured application timezone. */
export function todayKey(now: Date = new Date()): string {
  return dateKeyInTimeZone(now, appTimeZone());
}
