import test from "node:test";
import assert from "node:assert/strict";
import { resolveChildScopeForRequest } from "../lib/auth-scope";

test("parent keeps requested child scope", () => {
  const result = resolveChildScopeForRequest(
    { role: "parent", child_id: null },
    "child-123"
  );

  assert.equal(result.error, undefined);
  assert.equal(result.childId, "child-123");
});

test("kid without linked child gets missing_child_scope", () => {
  const result = resolveChildScopeForRequest(
    { role: "kid", child_id: null },
    null
  );

  assert.equal(result.error, "missing_child_scope");
  assert.equal(result.childId, null);
});

test("kid requesting a different child gets forbidden", () => {
  const result = resolveChildScopeForRequest(
    { role: "kid", child_id: "child-a" },
    "child-b"
  );

  assert.equal(result.error, "forbidden");
  assert.equal(result.childId, null);
});

test("kid without requested child is scoped to own child", () => {
  const result = resolveChildScopeForRequest(
    { role: "kid", child_id: "child-a" },
    null
  );

  assert.equal(result.error, undefined);
  assert.equal(result.childId, "child-a");
});
