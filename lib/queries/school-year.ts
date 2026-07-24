import pool from "@/lib/db";
import { todayKey } from "@/lib/utils/timezone";

export type SchoolYearRow = {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
};

export type ResolvedSchoolYear = SchoolYearRow & {
  /** True when today actually falls inside this year's range. */
  isCurrent: boolean;
  /** True when the year has not started yet (today is before start_date). */
  isUpcoming: boolean;
};

/**
 * The school year a page should report on.
 *
 * Families school year-round, so "today is inside a configured school year" is
 * not something the app can assume: a summer between years, or a year whose
 * dates were never extended, used to make every year-scoped stat collapse to
 * "0 of 0" while lessons were plainly still being scheduled. Rather than go
 * blank, fall back to the most recently started year (or, before any year has
 * started, the next one) and let callers say which year they are showing.
 *
 * Returns null only when no school years exist at all.
 */
export async function resolveActiveSchoolYear(
  today: string = todayKey()
): Promise<ResolvedSchoolYear | null> {
  const res = await pool.query(
    `SELECT id, label, start_date::text AS start_date, end_date::text AS end_date
     FROM school_years
     ORDER BY start_date ASC`
  );
  const years = res.rows as SchoolYearRow[];
  if (years.length === 0) return null;

  const current = years.find(
    (year) => year.start_date <= today && today <= year.end_date
  );
  if (current) return { ...current, isCurrent: true, isUpcoming: false };

  // Most recently started year — the one whose work the family is finishing.
  const started = years.filter((year) => year.start_date <= today);
  if (started.length > 0) {
    const latest = started[started.length - 1];
    return { ...latest, isCurrent: false, isUpcoming: false };
  }

  // Nothing has started yet: report on the year about to begin.
  return { ...years[0], isCurrent: false, isUpcoming: true };
}
