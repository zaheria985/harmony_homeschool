import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  formatDateKey,
  isSchoolDate,
  nextValidSchoolDate,
  parseDateKey,
} from "../lib/utils/school-dates";

/**
 * Mirrors the stepping logic in shiftLessons (lib/actions/schedule.ts). The
 * action itself needs a database, but the school-day arithmetic — the part
 * most likely to be subtly wrong — is pure and worth pinning down.
 */
function previousValidSchoolDate(
  from: Date,
  weekdays: Set<number>,
  overrides: Map<string, "exclude" | "include">,
): Date {
  let cursor = addDays(from, -1);
  for (let i = 0; i < 3660; i += 1) {
    if (isSchoolDate(cursor, weekdays, overrides)) return cursor;
    cursor = addDays(cursor, -1);
  }
  return from;
}

function shift(
  dateKey: string,
  schoolDays: number,
  weekdays: Set<number>,
  overrides = new Map<string, "exclude" | "include">(),
): string {
  const steps = Math.abs(schoolDays);
  const forward = schoolDays > 0;
  let cursor = parseDateKey(dateKey);
  for (let step = 0; step < steps; step += 1) {
    cursor = forward
      ? nextValidSchoolDate(addDays(cursor, 1), weekdays, overrides)
      : previousValidSchoolDate(cursor, weekdays, overrides);
  }
  return formatDateKey(cursor);
}

const MON_TO_FRI = new Set([1, 2, 3, 4, 5]);

test("a one-day shift moves to the next school day", () => {
  // 2026-07-20 is a Monday.
  assert.equal(shift("2026-07-20", 1, MON_TO_FRI), "2026-07-21");
});

test("shifting across a weekend counts school days, not calendar days", () => {
  // Friday + 1 school day = Monday, not Saturday.
  assert.equal(shift("2026-07-24", 1, MON_TO_FRI), "2026-07-27");
  // A full sick week: Monday + 5 school days = the following Monday.
  assert.equal(shift("2026-07-20", 5, MON_TO_FRI), "2026-07-27");
});

test("excluded days are skipped", () => {
  const overrides = new Map<string, "exclude" | "include">([
    ["2026-07-21", "exclude"], // a Tuesday holiday
  ]);
  assert.equal(shift("2026-07-20", 1, MON_TO_FRI, overrides), "2026-07-22");
});

test("included days are usable even on a weekend", () => {
  const overrides = new Map<string, "exclude" | "include">([
    ["2026-07-25", "include"], // a Saturday make-up day
  ]);
  assert.equal(shift("2026-07-24", 1, MON_TO_FRI, overrides), "2026-07-25");
});

test("a negative shift is the inverse of the positive one", () => {
  const start = "2026-07-20";
  for (const days of [1, 3, 5, 10]) {
    const moved = shift(start, days, MON_TO_FRI);
    assert.equal(
      shift(moved, -days, MON_TO_FRI),
      start,
      `${days}-day shift did not round-trip`,
    );
  }
});

test("undo round-trips across excluded days too", () => {
  const overrides = new Map<string, "exclude" | "include">([
    ["2026-07-22", "exclude"],
    ["2026-07-23", "exclude"],
  ]);
  const moved = shift("2026-07-20", 3, MON_TO_FRI, overrides);
  assert.equal(shift(moved, -3, MON_TO_FRI, overrides), "2026-07-20");
});
