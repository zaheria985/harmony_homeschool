import test from "node:test";
import assert from "node:assert/strict";
import { scopedChildId, type AuthedUser } from "../lib/server/authz";
import { inviteCodeMatches } from "../lib/server/signup-policy";

const parent: AuthedUser = {
  id: "parent-1",
  role: "parent",
  childId: null,
  permissionLevel: "full",
};

const kid: AuthedUser = {
  id: "kid-1",
  role: "kid",
  childId: "child-a",
  permissionLevel: "mark_complete",
};

test("parent acts on the requested child", () => {
  assert.equal(scopedChildId(parent, "child-b"), "child-b");
});

test("kid is pinned to their own child, ignoring a supplied id", () => {
  assert.equal(scopedChildId(kid, "child-b"), "child-a");
});

test("kid with no linked child resolves to null", () => {
  assert.equal(scopedChildId({ ...kid, childId: null }, "child-b"), null);
});

test("invite code check passes when no code is configured", () => {
  delete process.env.SIGNUP_INVITE_CODE;
  assert.equal(inviteCodeMatches(undefined), true);
});

test("invite code check requires an exact match when configured", () => {
  process.env.SIGNUP_INVITE_CODE = "let-me-in";
  assert.equal(inviteCodeMatches("let-me-in"), true);
  assert.equal(inviteCodeMatches("wrong"), false);
  assert.equal(inviteCodeMatches(undefined), false);
  delete process.env.SIGNUP_INVITE_CODE;
});
