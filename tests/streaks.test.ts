import test from "node:test";
import assert from "node:assert/strict";
import { computeStreak } from "../lib/utils/streaks";

// The family in these tests schools Mon/Tue/Fri (1, 2, 5).
const WEEKDAYS = new Set([1, 2, 5]);
const NO_OVERRIDES = new Map<string, "exclude" | "include">();

function streak(days: string[], today: string, overrides = NO_OVERRIDES) {
  return computeStreak(new Set(days), WEEKDAYS, overrides, today);
}

test("non-school days do not break a streak", () => {
  // Fri Jul 24, Mon Jul 27, Tue Jul 28 2026 are consecutive *school* days;
  // the weekend and Wed/Thu in between are not misses.
  const result = streak(["2026-07-24", "2026-07-27", "2026-07-28"], "2026-07-28");
  assert.equal(result.current, 3);
  assert.equal(result.best, 3);
});

test("an empty today does not end the streak", () => {
  // Tue Jul 28 is a school day with nothing done yet — the day is not over.
  const result = streak(["2026-07-24", "2026-07-27"], "2026-07-28");
  assert.equal(result.current, 2);
});

test("a missed school day ends the current streak but is kept in best", () => {
  // Mon Jul 27 missed; Fri Jul 24 and earlier no longer count as current.
  const result = streak(
    ["2026-07-17", "2026-07-20", "2026-07-21", "2026-07-24", "2026-07-28"],
    "2026-07-28",
  );
  assert.equal(result.current, 1);
  assert.equal(result.best, 4);
});

test("an excluded holiday is skipped rather than counted as a miss", () => {
  const overrides = new Map<string, "exclude" | "include">([
    ["2026-07-27", "exclude"],
  ]);
  const result = streak(["2026-07-24", "2026-07-28"], "2026-07-28", overrides);
  assert.equal(result.current, 2);
});

test("an included day counts even though it is not a school weekday", () => {
  // Wed Jul 22 is normally off; an "include" override makes it a school day.
  const overrides = new Map<string, "exclude" | "include">([
    ["2026-07-22", "include"],
  ]);
  const missedIncludedDay = streak(["2026-07-21", "2026-07-24"], "2026-07-24", overrides);
  assert.equal(missedIncludedDay.current, 1, "the included day was skipped, not missed");

  const workedIncludedDay = streak(
    ["2026-07-21", "2026-07-22", "2026-07-24"],
    "2026-07-24",
    overrides,
  );
  assert.equal(workedIncludedDay.current, 3);
});

test("no configured school days means no streak", () => {
  const result = computeStreak(
    new Set(["2026-07-24"]),
    new Set(),
    NO_OVERRIDES,
    "2026-07-24",
  );
  assert.deepEqual(result, { current: 0, best: 0 });
});
