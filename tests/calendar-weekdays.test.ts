import test from "node:test";
import assert from "node:assert/strict";
import { hasWeekdayChanges, normalizeWeekdays } from "../lib/utils/calendar-weekdays";

test("normalizeWeekdays filters invalid values and sorts uniquely", () => {
  const result = normalizeWeekdays([5, 1, 1, 8, -1, 3]);
  assert.deepEqual(result, [1, 3, 5]);
});

test("hasWeekdayChanges detects equivalent sets as unchanged", () => {
  const changed = hasWeekdayChanges([5, 1, 3], [1, 3, 5]);
  assert.equal(changed, false);
});

test("hasWeekdayChanges detects real weekday differences", () => {
  const changed = hasWeekdayChanges([1, 2, 3], [1, 3, 5]);
  assert.equal(changed, true);
});

test("normalizeWeekdays returns empty array when no valid days provided", () => {
  const result = normalizeWeekdays([-2, 10, NaN, 7]);
  assert.deepEqual(result, []);
});

test("hasWeekdayChanges ignores duplicates and invalid inputs when comparing", () => {
  const changed = hasWeekdayChanges([0, 0, 7], [0]);
  assert.equal(changed, false);
});
