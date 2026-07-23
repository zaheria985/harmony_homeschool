import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Guards the fresh-install path: db/schema.sql is applied top-to-bottom by
 * db/bootstrap.js on a brand-new database, so a table may only be referenced
 * after it has been created. A forward reference makes new deploys crash-loop,
 * which existing installs never notice.
 */
function schemaLines(): string[] {
  const file = path.join(__dirname, "..", "db", "schema.sql");
  // Strip line comments so commented-out SQL is not parsed as real.
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.replace(/--.*$/, ""));
}

test("every foreign key references a table created earlier in schema.sql", () => {
  const lines = schemaLines();
  const created = new Map<string, number>();

  lines.forEach((line, i) => {
    const match = /CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i.exec(line);
    if (match) created.set(match[1].toLowerCase(), i);
  });

  const problems: string[] = [];

  lines.forEach((line, i) => {
    for (const match of line.matchAll(/REFERENCES\s+(\w+)\s*\(/gi)) {
      const target = match[1].toLowerCase();
      const createdAt = created.get(target);

      if (createdAt === undefined) {
        problems.push(`line ${i + 1}: REFERENCES ${target} — table never created`);
        continue;
      }

      if (createdAt > i) {
        // Legal only when the FK is added by a later ALTER TABLE statement.
        const context = lines.slice(Math.max(0, i - 4), i + 1).join("\n");
        if (!/ALTER TABLE/i.test(context)) {
          problems.push(
            `line ${i + 1}: REFERENCES ${target}, created later at line ${createdAt + 1}`
          );
        }
      }
    }
  });

  assert.deepEqual(problems, [], `schema.sql cannot apply to an empty database:\n${problems.join("\n")}`);
});

test("schema.sql creates the core tables the app depends on", () => {
  const joined = schemaLines().join("\n");
  for (const table of [
    "users",
    "children",
    "lessons",
    "curricula",
    "lesson_completions",
    "resources",
    "lesson_cards",
  ]) {
    assert.match(
      joined,
      new RegExp(`CREATE TABLE (?:IF NOT EXISTS )?${table}\\b`, "i"),
      `missing CREATE TABLE ${table}`
    );
  }
});
