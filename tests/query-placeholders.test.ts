import test from "node:test";
import assert from "node:assert/strict";
import pool from "../lib/db";

/**
 * Every `$n` a query builds must line up with the parameters it passes.
 *
 * Several of these queries assemble their WHERE clause from optional filters
 * and number the placeholders as they go, so adding or reordering a parameter
 * silently shifts the rest. Postgres catches it at runtime — "bind message
 * supplies 2 parameters, but prepared statement requires 3" — which means the
 * page is already broken in production by the time anyone notices.
 *
 * This runs the query builders against a stubbed pool: no database, but the
 * real SQL string and the real parameter array.
 */

type Call = { sql: string; params: unknown[] };
const calls: Call[] = [];

// The query functions all call pool.query on this same object, so replacing
// the method is enough to intercept them.
const realQuery = pool.query.bind(pool);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(pool as any).query = async (sql: string, params: unknown[] = []) => {
  calls.push({ sql, params });
  return { rows: [], rowCount: 0 };
};

function check(label: string) {
  for (const { sql, params } of calls) {
    const used = new Set(
      [...sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1])),
    );
    const highest = used.size > 0 ? Math.max(...used) : 0;

    assert.ok(
      highest <= params.length,
      `${label}: SQL references $${highest} but only ${params.length} parameter(s) were passed:\n${sql}`,
    );

    for (let i = 1; i <= highest; i += 1) {
      assert.ok(
        used.has(i),
        `${label}: SQL skips $${i} (placeholders must be contiguous):\n${sql}`,
      );
    }

    // A SELECT DISTINCT may only ORDER BY expressions in its select list;
    // Postgres rejects the query outright otherwise.
    if (/SELECT\s+DISTINCT\b/i.test(sql)) {
      const selectList = /SELECT\s+DISTINCT\b([\s\S]*?)\bFROM\b/i.exec(sql)?.[1] ?? "";
      const orderBy = /\bORDER BY\b([\s\S]*?)(?:\bLIMIT\b|$)/i.exec(sql)?.[1] ?? "";
      for (const term of orderBy.split(",")) {
        const expr = term.trim().replace(/\s+(ASC|DESC)$/i, "").trim();
        if (!expr) continue;

        const present = expr.includes(".")
          ? // A qualified column must appear in the select list as that exact
            // expression. `l.planned_date::text AS planned_date` does NOT
            // satisfy `ORDER BY l.planned_date` — the cast makes it a different
            // expression, and Postgres rejects the query.
            new RegExp(`${expr.replace(".", "\\.")}(?!\\s*::)`, "i").test(selectList)
          : // A bare name may be an output alias.
            new RegExp(`\\bAS\\s+${expr}\\b`, "i").test(selectList) ||
            new RegExp(`(^|,)\\s*${expr}\\s*(,|$)`, "i").test(selectList);

        assert.ok(
          present,
          `${label}: SELECT DISTINCT orders by "${expr}", which is not in the select list:\n${sql}`,
        );
      }
    }
  }
  calls.length = 0;
}

test("dashboard queries bind every placeholder they reference", async () => {
  const dashboard = await import("../lib/queries/dashboard");

  await dashboard.getUpcomingDueLessons(3);
  check("getUpcomingDueLessons()");

  await dashboard.getUpcomingDueLessons(7, "11111111-1111-1111-1111-111111111111");
  check("getUpcomingDueLessons(child)");

  await dashboard.getUpcomingDueLessons(
    3,
    "11111111-1111-1111-1111-111111111111",
    "22222222-2222-2222-2222-222222222222",
  );
  check("getUpcomingDueLessons(child, parent)");

  await dashboard.getDashboardStats();
  check("getDashboardStats()");

  await dashboard.getDashboardStats("22222222-2222-2222-2222-222222222222");
  check("getDashboardStats(parent)");

  await dashboard.getPendingCompletionKeys();
  check("getPendingCompletionKeys()");

  await dashboard.getPendingCompletionKeys("11111111-1111-1111-1111-111111111111");
  check("getPendingCompletionKeys(child)");

  await dashboard.getDashboardActivity();
  check("getDashboardActivity()");

  await dashboard.getDashboardActivity("22222222-2222-2222-2222-222222222222");
  check("getDashboardActivity(parent)");

  await dashboard.getTodayAssignmentsOverview();
  check("getTodayAssignmentsOverview()");
});

test("student and report queries bind every placeholder they reference", async () => {
  const students = await import("../lib/queries/students");
  const reports = await import("../lib/queries/reports");
  const lessons = await import("../lib/queries/lessons");
  const prep = await import("../lib/queries/prep");
  const calendar = await import("../lib/queries/calendar");
  const child = "11111111-1111-1111-1111-111111111111";
  const year = "33333333-3333-3333-3333-333333333333";

  await students.getAllChildren();
  check("getAllChildren()");
  await students.getAllChildren("22222222-2222-2222-2222-222222222222");
  check("getAllChildren(parent)");
  await students.getChildProgress(child);
  check("getChildProgress()");
  await students.getChildProgress(child, year);
  check("getChildProgress(year)");
  await students.getChildSubjects(child, year);
  check("getChildSubjects(year)");
  await students.getCompletedCurricula(child, year);
  check("getCompletedCurricula(year)");

  await reports.getProgressReport(child, year);
  check("getProgressReport()");
  await reports.getCompletedLessons({});
  check("getCompletedLessons({})");
  await reports.getCompletedLessons({
    childId: child,
    subjectId: "44444444-4444-4444-4444-444444444444",
    startDate: "2026-01-01",
    endDate: "2026-06-01",
    yearId: year,
  });
  check("getCompletedLessons(all filters)");

  await lessons.getAllLessons();
  check("getAllLessons()");
  await lessons.getAllLessons({ childId: child, status: "planned" });
  check("getAllLessons(filters)");
  await lessons.getAllLessonsWithResources({ childId: child });
  check("getAllLessonsWithResources(child)");
  await lessons.getUpcomingLessons(child);
  check("getUpcomingLessons()");
  await lessons.getLessonsByChild(child, { status: "planned" });
  check("getLessonsByChild(status)");

  await prep.getUpcomingPrepMaterials(7);
  check("getUpcomingPrepMaterials()");
  await prep.getUpcomingPrepMaterials(7, child);
  check("getUpcomingPrepMaterials(child)");

  await calendar.getLessonsForMonth(child, 2026, 7, "all");
  check("getLessonsForMonth(all)");
  await calendar.getLessonsForMonth("", 2026, 7, "completed", "22222222-2222-2222-2222-222222222222");
  check("getLessonsForMonth(completed, parent)");
  await calendar.getSemesterOverview("2026-08", 6, child);
  check("getSemesterOverview(child)");
});

test.after(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (pool as any).query = realQuery;
});
