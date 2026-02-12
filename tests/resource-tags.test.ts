import test from "node:test";
import assert from "node:assert/strict";
import { mergeTagNames, parseTagNames } from "../lib/utils/resource-tags";

test("parseTagNames normalizes case, trims, deduplicates", () => {
  const parsed = parseTagNames("  Math, science,math,  SCIENCE , ");
  assert.deepEqual(parsed, ["math", "science"]);
});

test("mergeTagNames combines existing and extras uniquely", () => {
  const merged = mergeTagNames("history, read-aloud", ["History", "Author X"]);
  assert.deepEqual(merged, ["history", "read-aloud", "author x"]);
});

test("parseTagNames returns empty list for undefined or blank input", () => {
  assert.deepEqual(parseTagNames(undefined), []);
  assert.deepEqual(parseTagNames("   ,  , "), []);
});

test("mergeTagNames ignores empty extras and normalizes casing", () => {
  const merged = mergeTagNames("Art", ["art", "  ", "Language"]);
  assert.deepEqual(merged, ["art", "language"]);
});
