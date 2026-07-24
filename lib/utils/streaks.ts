import { addDays, formatDateKey, isSchoolDate, parseDateKey } from "@/lib/utils/school-dates";

/**
 * Streaks count *school* days, not calendar days.
 *
 * A family that schools Mon/Tue/Fri has not broken a streak by doing nothing on
 * Wednesday, and a holiday in the middle of the week should not reset it
 * either — so days that are not school days are skipped rather than counted as
 * misses. Today never breaks a streak: the day is not over yet.
 */
export function computeStreak(
  completedDays: Set<string>,
  weekdays: Set<number>,
  overrides: Map<string, "exclude" | "include">,
  today: string,
  lookbackDays = 400,
): { current: number; best: number } {
  if (weekdays.size === 0 && overrides.size === 0) {
    return { current: 0, best: 0 };
  }

  // Walk backwards over school days from today, collecting hit/miss.
  const schoolDays: string[] = [];
  let cursor = parseDateKey(today);
  for (let i = 0; i < lookbackDays; i += 1) {
    const key = formatDateKey(cursor);
    if (isSchoolDate(cursor, weekdays, overrides)) schoolDays.push(key);
    cursor = addDays(cursor, -1);
  }

  let current = 0;
  let counting = true;
  let best = 0;
  let run = 0;

  schoolDays.forEach((day, index) => {
    const done = completedDays.has(day);
    if (done) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }

    if (counting) {
      if (done) {
        current += 1;
      } else if (index === 0 && day === today) {
        // Today is still in progress — an empty today does not end the streak.
      } else {
        counting = false;
      }
    }
  });

  return { current, best };
}
