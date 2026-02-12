import test from "node:test";
import assert from "node:assert/strict";
import { completionValuePayload } from "../lib/utils/completion-values";

test("numeric grade payload keeps grade and nulls pass/fail", () => {
  const payload = completionValuePayload({
    gradeType: "numeric",
    grade: 92,
    passFail: "fail",
    notes: "Nice work",
  });

  assert.equal(payload.grade, 92);
  assert.equal(payload.passFail, null);
  assert.equal(payload.notes, "Nice work");
});

test("pass/fail payload defaults pass and nulls numeric grade", () => {
  const payload = completionValuePayload({
    gradeType: "pass_fail",
    grade: 88,
  });

  assert.equal(payload.grade, null);
  assert.equal(payload.passFail, "pass");
  assert.equal(payload.notes, null);
});

test("pass/fail payload respects explicit status and notes", () => {
  const payload = completionValuePayload({
    gradeType: "pass_fail",
    passFail: "fail",
    notes: "Needs revision",
  });

  assert.equal(payload.grade, null);
  assert.equal(payload.passFail, "fail");
  assert.equal(payload.notes, "Needs revision");
});

test("numeric payload without grade falls back to null", () => {
  const payload = completionValuePayload({
    gradeType: "numeric",
  });

  assert.equal(payload.grade, null);
  assert.equal(payload.passFail, null);
  assert.equal(payload.notes, null);
});
