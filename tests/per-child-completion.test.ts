import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Completion is per child, not per lesson row.
 *
 * Curricula are shared: two children assigned the same course share the same
 * `lessons` rows, so `lessons.status` is one field describing work that two
 * children do separately. Keying a child-scoped view on it meant one child
 * finishing a lesson removed it from their sibling's due list and counted as
 * the sibling's progress. Per-child views must key on `lesson_completions`
 * joined to that child instead.
 *
 * `lessons.status` still has a job — planned / in_progress / skipped, and
 * "completed" once *every* assignee is done (lib/actions/completions.ts) — so
 * household-wide aggregates may still use it. Only the child-scoped functions
 * below are covered here.
 */

function fileSource(...segments: string[]): string {
  return readFileSync(path.join(__dirname, "..", ...segments), "utf8");
}

/** The body of an exported function, up to the next top-level export. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}`);
  assert.notEqual(start, -1, `${name} not found`);
  const rest = source.slice(start + 1);
  const end = rest.indexOf("\nexport ");
  return end === -1 ? rest : rest.slice(0, end);
}

const CHILD_SCOPED: Array<{ file: string[]; fn: string }> = [
  { file: ["lib", "queries", "dashboard.ts"], fn: "getUpcomingDueLessons" },
  { file: ["lib", "queries", "dashboard.ts"], fn: "getDashboardActivity" },
  { file: ["lib", "queries", "dashboard.ts"], fn: "getTodayAssignmentsOverview" },
  { file: ["lib", "queries", "students.ts"], fn: "getChildProgress" },
  { file: ["lib", "queries", "students.ts"], fn: "getChildSubjects" },
  { file: ["lib", "queries", "students.ts"], fn: "getCompletedCurricula" },
  { file: ["lib", "queries", "reports.ts"], fn: "getProgressReport" },
  { file: ["lib", "queries", "reports.ts"], fn: "getCompletedLessons" },
  { file: ["lib", "queries", "lessons.ts"], fn: "getUpcomingLessons" },
  { file: ["lib", "queries", "calendar.ts"], fn: "getLessonsForMonth" },
  { file: ["lib", "queries", "today.ts"], fn: "getTodayLessons" },
  { file: ["lib", "queries", "today.ts"], fn: "getWeekProgress" },
  { file: ["lib", "queries", "today.ts"], fn: "getOverdueCount" },
];

test("child-scoped queries do not decide completion from the shared lesson status", () => {
  const problems: string[] = [];

  for (const { file, fn } of CHILD_SCOPED) {
    const body = functionBody(fileSource(...file), fn);

    if (/l\.status\s*(=|!=)\s*'completed'/.test(body)) {
      problems.push(`${file.join("/")}: ${fn} keys on l.status = 'completed'`);
    }
    if (!/lesson_completions/.test(body)) {
      problems.push(`${file.join("/")}: ${fn} never consults lesson_completions`);
    }
  }

  assert.deepEqual(problems, [], problems.join("\n"));
});

test("completion joins are scoped to a child", () => {
  // A `lesson_completions` join without a child predicate matches any child's
  // completion, which is the same bug wearing a different hat.
  const problems: string[] = [];

  for (const { file, fn } of CHILD_SCOPED) {
    const body = functionBody(fileSource(...file), fn);
    const joins = [...body.matchAll(/(?:JOIN|EXISTS \(\s*SELECT 1 FROM)\s+lesson_completions\s+(\w+)([\s\S]{0,220})/gi)];

    for (const [, alias, following] of joins) {
      const scoped = new RegExp(`${alias}\\.child_id\\s*=`, "i").test(following);
      if (!scoped) {
        problems.push(
          `${file.join("/")}: ${fn} joins lesson_completions (${alias}) without a child_id predicate`,
        );
      }
    }
  }

  assert.deepEqual(problems, [], problems.join("\n"));
});
