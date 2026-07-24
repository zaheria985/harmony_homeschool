import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * The three routines that rewrite planned_date in bulk — the post-completion
 * gap fill, the nightly overdue bump, and the reschedule cascade — decide which
 * lessons to move purely in SQL, so their WHERE clauses are the behavior.
 *
 * Two regressions live here:
 *
 *  - The gap fill selected every incomplete lesson in the course, not only the
 *    ones after the completed date. Ticking off Thursday's lesson on Monday
 *    therefore pushed Monday/Tuesday/Wednesday's work forward to Thursday and
 *    beyond, corrupting the schedule on an ordinary "worked ahead" day.
 *  - None of them excluded archived lessons, so an archived-but-incomplete
 *    lesson stayed permanently overdue: the cron rewrote its date every night
 *    and it consumed school-day slots ahead of real work.
 *
 * These need a database to exercise end to end; asserting on the query text
 * keeps the guard cheap and still fails if the clause is dropped.
 */

function read(...segments: string[]): string {
  return readFileSync(path.join(__dirname, "..", ...segments), "utf8");
}

/** The SQL template literals in a source file. */
function sqlBlocks(source: string): string[] {
  return [...source.matchAll(/`([^`]*)`/g)]
    .map((m) => m[1])
    .filter((block) => /\bFROM\b|\bUPDATE\b/i.test(block));
}

function blocksSelectingLessonsToMove(source: string): string[] {
  return sqlBlocks(source).filter(
    (block) => /\bFROM\s+lessons\b/i.test(block) && /planned_date/i.test(block),
  );
}

test("the post-completion gap fill only moves lessons after the completed one", () => {
  const source = read("lib", "actions", "lessons.ts");
  const block = blocksSelectingLessonsToMove(source).find((b) =>
    /status\s*!=\s*'completed'/i.test(b) && /ORDER BY l\.planned_date/i.test(b),
  );

  assert.ok(block, "could not find the remaining-lessons query in lessons.ts");
  assert.match(
    block,
    /l\.planned_date\s*>\s*\$\d/i,
    "gap fill must bound the shift to lessons planned after the completed lesson",
  );
});

test("bulk reschedule routines skip archived lessons", () => {
  const files: Array<[string, string[]]> = [
    ["lesson-bump", ["lib", "server", "lesson-bump.ts"]],
    ["lessons actions", ["lib", "actions", "lessons.ts"]],
  ];

  for (const [label, segments] of files) {
    const source = read(...segments);
    const candidates = sqlBlocks(source).filter(
      (block) =>
        /\blessons\b/i.test(block) &&
        /status\s*!=\s*'completed'/i.test(block) &&
        /planned_date/i.test(block),
    );

    assert.ok(candidates.length > 0, `${label}: no reschedule queries found`);
    for (const block of candidates) {
      assert.match(
        block,
        /archived\s*=\s*false/i,
        `${label}: a query that moves lessons does not exclude archived ones:\n${block}`,
      );
    }
  }
});
