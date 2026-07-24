import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

/**
 * Date columns must leave SQL as text.
 *
 * node-postgres hydrates a DATE column into a JS Date, and the client tables
 * sort and slice those values as strings (`a.localeCompare(b)`,
 * `value.split("T")[0]`). A single uncast `l.planned_date` took the whole
 * /lessons page down with "localeCompare is not a function" — the page render
 * throws before anything can catch it. Casting in SQL is the fix, so guard it
 * here rather than trusting review.
 */

const QUERY_DIR = path.join(__dirname, "..", "lib", "queries");

/** Date (not timestamp) columns that reach client components. */
const DATE_COLUMNS = [
  "planned_date",
  "start_date",
  "end_date",
  "actual_start_date",
  "actual_end_date",
];

/**
 * The projection lists of every SELECT in the file — the text between SELECT
 * and its FROM. GROUP BY / ORDER BY / WHERE mention the same column names but
 * do not shape the returned row, so they are deliberately excluded.
 */
function selectLists(source: string): string[] {
  return [...source.matchAll(/\bSELECT\b([\s\S]*?)\bFROM\b/gi)].map((m) => m[1]);
}

test("date columns are cast to text wherever they are selected", () => {
  const problems: string[] = [];

  for (const file of readdirSync(QUERY_DIR).filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(path.join(QUERY_DIR, file), "utf8");

    for (const list of selectLists(source)) {
      for (const line of list.split("\n").map((l) => l.trim())) {
        if (line.startsWith("--")) continue;
        for (const column of DATE_COLUMNS) {
          // A projection looks like `alias.column,` or `alias.column AS x`.
          const projection = new RegExp(
            `^(?:[a-z0-9_]+\\.)?${column}\\s*(,|$|AS\\s)`,
            "i",
          );
          if (!projection.test(line)) continue;
          if (line.includes("::text")) continue;
          problems.push(`${file}: ${line}`);
        }
      }
    }
  }

  assert.deepEqual(
    problems,
    [],
    `Date columns selected without ::text (client code treats them as strings):\n${problems.join("\n")}`,
  );
});
