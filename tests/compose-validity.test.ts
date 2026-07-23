import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

/**
 * A malformed compose file takes the whole stack down on the next deploy, and
 * the failure only shows up on the server. Common trap: an unquoted value
 * containing ": " (such as a ${VAR:?error message} default) silently parses as
 * a nested mapping, or fails outright.
 */
const repoRoot = path.join(__dirname, "..");

function composeFiles(): string[] {
  return readdirSync(repoRoot).filter(
    (f) => f.startsWith("docker-compose") && (f.endsWith(".yml") || f.endsWith(".yaml"))
  );
}

test("every docker-compose file is valid YAML with a services block", () => {
  const files = composeFiles();
  assert.ok(files.length > 0, "expected at least one docker-compose file");

  for (const file of files) {
    const raw = readFileSync(path.join(repoRoot, file), "utf8");

    let parsed: unknown;
    assert.doesNotThrow(() => {
      parsed = yaml.load(raw);
    }, `${file} is not valid YAML`);

    const doc = parsed as { services?: Record<string, unknown> };
    assert.ok(doc?.services, `${file} has no services block`);
    assert.ok(
      Object.keys(doc.services).length > 0,
      `${file} defines no services`
    );
  }
});

test("compose env values containing ': ' are quoted", () => {
  for (const file of composeFiles()) {
    const raw = readFileSync(path.join(repoRoot, file), "utf8");

    raw.split("\n").forEach((line, i) => {
      // An environment entry: KEY: value
      const match = /^\s+[A-Z_][A-Z0-9_]*:\s+(.*)$/.exec(line);
      if (!match) return;

      const value = match[1].trim();
      if (!value || value.startsWith('"') || value.startsWith("'")) return;

      assert.ok(
        !value.includes(": "),
        `${file}:${i + 1} unquoted value contains ": " and will break YAML parsing:\n  ${line.trim()}`
      );
    });
  }
});
