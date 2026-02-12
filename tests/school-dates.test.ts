import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  formatDateKey,
  isSchoolDate,
  nextValidSchoolDate,
  parseDateKey,
} from "../lib/utils/school-dates";

test("formatDateKey and parseDateKey round-trip UTC date keys", () => {
  const parsed = parseDateKey("2026-02-10");
  assert.equal(formatDateKey(parsed), "2026-02-10");
});

test("addDays advances date key by one day", () => {
  const start = parseDateKey("2026-02-10");
  const next = addDays(start, 1);
  assert.equal(formatDateKey(next), "2026-02-11");
});

test("isSchoolDate honors include/exclude overrides over weekday defaults", () => {
  const weekdays = new Set<number>([1, 2, 3, 4, 5]); // Mon-Fri
  const overrides = new Map<string, "exclude" | "include">([
    ["2026-02-11", "exclude"],
    ["2026-02-14", "include"],
  ]);

  assert.equal(isSchoolDate(parseDateKey("2026-02-11"), weekdays, overrides), false); // excluded weekday
  assert.equal(isSchoolDate(parseDateKey("2026-02-14"), weekdays, overrides), true); // included Saturday
});

test("nextValidSchoolDate finds first valid school date", () => {
  const weekdays = new Set<number>([1, 2, 3, 4, 5]); // Mon-Fri
  const overrides = new Map<string, "exclude" | "include">([
    ["2026-02-10", "exclude"],
  ]);

  const start = parseDateKey("2026-02-10");
  const next = nextValidSchoolDate(start, weekdays, overrides);

  assert.equal(formatDateKey(next), "2026-02-11");
});

test("isSchoolDate falls back to weekday set when no override", () => {
  const weekdays = new Set<number>([1, 2, 3, 4, 5]);
  const overrides = new Map<string, "exclude" | "include">();

  assert.equal(isSchoolDate(parseDateKey("2026-02-14"), weekdays, overrides), false);
  assert.equal(isSchoolDate(parseDateKey("2026-02-16"), weekdays, overrides), true);
});

test("nextValidSchoolDate returns start date when it already qualifies", () => {
  const weekdays = new Set<number>([1, 2, 3, 4, 5]);
  const overrides = new Map<string, "exclude" | "include">();

  const start = parseDateKey("2026-02-17");
  const next = nextValidSchoolDate(start, weekdays, overrides);

  assert.equal(formatDateKey(next), "2026-02-17");
});
