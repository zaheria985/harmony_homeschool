import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * `lesson_cards.card_type` is constrained in the database, so a card type the
 * UI offers but the CHECK constraint does not know about fails at insert time
 * — after the parent has typed their content, which is the worst moment to
 * find out.
 *
 * These tests pin the three places the list has to agree: the migration, the
 * action's zod schema, and what the picker actually sends.
 */

const ROOT = path.join(__dirname, "..");

/** The card types the database will accept, read from the migrations. */
function allowedCardTypes(): Set<string> {
  const dir = path.join(ROOT, "db", "migrations");
  // The newest migration that redefines the constraint wins.
  const files = readdirSync(dir).sort();
  let latest: string | null = null;
  for (const file of files) {
    const source = readFileSync(path.join(dir, file), "utf8");
    const match = source.match(
      /card_type\s+IN\s*\(([^)]*)\)/i,
    );
    if (match) latest = match[1];
  }
  assert.ok(latest, "no card_type CHECK constraint found in migrations");
  return new Set(
    [...latest!.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]),
  );
}

test("the action's card types all exist in the database constraint", () => {
  const allowed = allowedCardTypes();
  const source = readFileSync(
    path.join(ROOT, "lib", "actions", "lesson-cards.ts"),
    "utf8",
  );

  const enums = [...source.matchAll(/card_type:\s*z\.enum\(\[([^\]]*)\]\)/g)];
  assert.ok(enums.length > 0, "expected a card_type zod enum");

  const problems: string[] = [];
  for (const [, body] of enums) {
    for (const [, value] of body.matchAll(/"([a-z_]+)"/g)) {
      if (!allowed.has(value)) {
        problems.push(`zod allows card_type "${value}", the database does not`);
      }
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("the picker only sends card types the database accepts", () => {
  const allowed = allowedCardTypes();
  const source = readFileSync(
    path.join(ROOT, "components", "lessons", "AddToLessonPicker.tsx"),
    "utf8",
  );

  const sent = [
    ...source.matchAll(/set\("card_type",\s*"([a-z_]+)"\)/g),
  ].map((match) => match[1]);
  assert.ok(sent.length > 0, "expected the picker to set card_type somewhere");

  const problems = sent
    .filter((value) => !allowed.has(value))
    .map((value) => `picker sends card_type "${value}", the database does not accept it`);
  assert.deepEqual(problems, [], problems.join("\n"));
});

test("a checklist card is written as a markdown task list", () => {
  // Tick state lives in the content itself (`- [ ]` / `- [x]`), which is why
  // checklist cards need no state column and survive export intact. The
  // renderers all parse that exact prefix.
  const source = readFileSync(
    path.join(ROOT, "components", "lessons", "AddToLessonPicker.tsx"),
    "utf8",
  );
  assert.match(
    source,
    /- \[ \] \$\{line\}/,
    "checklist items should be written as unchecked markdown task list lines",
  );
});

test("no surface still offers the removed FileRun resource type", () => {
  // FileRun was dropped from the app two rounds ago; the option lingered in
  // both lesson forms and silently created dead resources.
  const files = [
    ["components", "lessons", "LessonFormModal.tsx"],
    ["app", "calendar", "LessonFormModal.tsx"],
    ["components", "lessons", "AddToLessonPicker.tsx"],
  ];
  const problems: string[] = [];
  for (const segments of files) {
    const source = readFileSync(path.join(ROOT, ...segments), "utf8");
    if (/value="filerun"/i.test(source)) {
      problems.push(`${segments.join("/")} still offers FileRun`);
    }
  }
  assert.deepEqual(problems, [], problems.join("\n"));
});
