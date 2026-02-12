const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDateKey(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export function formatDateKey(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

export function isSchoolDate(
  date: Date,
  weekdays: Set<number>,
  overrides: Map<string, "exclude" | "include">
): boolean {
  const key = formatDateKey(date);
  const override = overrides.get(key);
  if (override === "include") return true;
  if (override === "exclude") return false;
  return weekdays.has(date.getUTCDay());
}

export function nextValidSchoolDate(
  start: Date,
  weekdays: Set<number>,
  overrides: Map<string, "exclude" | "include">
): Date {
  let cursor = start;
  for (let i = 0; i < 3660; i += 1) {
    if (isSchoolDate(cursor, weekdays, overrides)) return cursor;
    cursor = addDays(cursor, 1);
  }
  return start;
}
