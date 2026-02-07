/**
 * Date utilities for the weekly planner.
 * All date strings are ISO format "YYYY-MM-DD".
 */

/** Returns the Monday of the week containing the given date. */
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun, 1=Mon, ...
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateStr(d);
}

/** Returns Friday of the week starting on the given Monday. */
export function getWeekEnd(weekStart: string): string {
  const d = parseDate(weekStart);
  d.setDate(d.getDate() + 4);
  return toDateStr(d);
}

/** Returns Sunday of the week starting on the given Monday. */
export function getFullWeekEnd(weekStart: string): string {
  const d = parseDate(weekStart);
  d.setDate(d.getDate() + 6);
  return toDateStr(d);
}

/** Returns Mon-Fri date strings for the week starting on the given Monday. */
export function getWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const d = parseDate(weekStart);
  for (let i = 0; i < 5; i++) {
    dates.push(toDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

/** Returns Mon-Sun date strings for the week starting on the given Monday. */
export function getFullWeekDates(weekStart: string): string[] {
  const dates: string[] = [];
  const d = parseDate(weekStart);
  for (let i = 0; i < 7; i++) {
    dates.push(toDateStr(d));
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "Monday", "Tuesday", etc. */
export function formatWeekday(dateStr: string): string {
  return WEEKDAY_NAMES[parseDate(dateStr).getDay()];
}

/** "Mon", "Tue", etc. */
export function formatWeekdayShort(dateStr: string): string {
  return WEEKDAY_SHORT[parseDate(dateStr).getDay()];
}

/** "Sep 1" */
export function formatShortDate(dateStr: string): string {
  const d = parseDate(dateStr);
  return `${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
}

/** "Week of Sep 1" */
export function formatWeekLabel(weekStart: string): string {
  return `Week of ${formatShortDate(weekStart)}`;
}

/** Checks whether a date is a school day given weekday numbers and overrides. */
export function isSchoolDay(
  dateStr: string,
  weekdays: number[],
  overrides: { date: string; type: "exclude" | "include" }[]
): boolean {
  const override = overrides.find((o) => o.date === dateStr);
  if (override) return override.type === "include";
  const day = parseDate(dateStr).getDay();
  return weekdays.includes(day);
}

/** Finds the next school day on or after the given date. */
export function getNextSchoolDayDate(
  after: string,
  weekdays: number[],
  overrides: { date: string; type: "exclude" | "include" }[]
): string {
  const d = parseDate(after);
  for (let i = 0; i < 365; i++) {
    const s = toDateStr(d);
    if (isSchoolDay(s, weekdays, overrides)) return s;
    d.setDate(d.getDate() + 1);
  }
  return after; // fallback
}

/** Parse "YYYY-MM-DD" into a Date (local midnight). */
export function parseDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as "YYYY-MM-DD". */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Navigate to previous week's Monday. */
export function prevWeek(weekStart: string): string {
  const d = parseDate(weekStart);
  d.setDate(d.getDate() - 7);
  return toDateStr(d);
}

/** Navigate to next week's Monday. */
export function nextWeek(weekStart: string): string {
  const d = parseDate(weekStart);
  d.setDate(d.getDate() + 7);
  return toDateStr(d);
}

/** Check if a date string matches today. */
export function isToday(dateStr: string): boolean {
  return dateStr === toDateStr(new Date());
}
