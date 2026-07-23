import test from "node:test";
import assert from "node:assert/strict";
import {
  gradePointsFromPercent,
  letterFromPercent,
} from "../lib/queries/transcript";

test("letter grades use standard cut-offs", () => {
  assert.equal(letterFromPercent(100), "A");
  assert.equal(letterFromPercent(90), "A");
  assert.equal(letterFromPercent(89.9), "B");
  assert.equal(letterFromPercent(80), "B");
  assert.equal(letterFromPercent(79.9), "C");
  assert.equal(letterFromPercent(70), "C");
  assert.equal(letterFromPercent(69.9), "D");
  assert.equal(letterFromPercent(60), "D");
  assert.equal(letterFromPercent(59.9), "F");
  assert.equal(letterFromPercent(0), "F");
});

test("grade points map to a 4.0 scale", () => {
  assert.equal(gradePointsFromPercent(95), 4);
  assert.equal(gradePointsFromPercent(85), 3);
  assert.equal(gradePointsFromPercent(75), 2);
  assert.equal(gradePointsFromPercent(65), 1);
  assert.equal(gradePointsFromPercent(50), 0);
});

test("letters and grade points agree at every boundary", () => {
  const expected: Record<string, number> = { A: 4, B: 3, C: 2, D: 1, F: 0 };
  for (const percent of [100, 90, 89, 80, 79, 70, 69, 60, 59, 0]) {
    assert.equal(
      gradePointsFromPercent(percent),
      expected[letterFromPercent(percent)],
      `mismatch at ${percent}%`,
    );
  }
});
