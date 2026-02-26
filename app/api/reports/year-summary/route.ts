import { NextRequest, NextResponse } from "next/server";
import { getChildById, getYearSummaryReport } from "@/lib/queries/students";
import pool from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const childId = searchParams.get("childId");
  const yearId = searchParams.get("yearId");

  if (!childId || !yearId) {
    return NextResponse.json(
      { error: "childId and yearId are required" },
      { status: 400 }
    );
  }

  const child = await getChildById(childId);
  if (!child) {
    return NextResponse.json({ error: "Child not found" }, { status: 404 });
  }

  const yearRes = await pool.query(
    `SELECT id, label, start_date::text, end_date::text FROM school_years WHERE id = $1`,
    [yearId]
  );
  const year = yearRes.rows[0];
  if (!year) {
    return NextResponse.json(
      { error: "School year not found" },
      { status: 404 }
    );
  }

  const rows = await getYearSummaryReport(childId, yearId);

  // Build report text
  const divider = "=".repeat(60);
  const subDivider = "-".repeat(60);
  const lines: string[] = [];

  lines.push(divider);
  lines.push(`  YEAR SUMMARY REPORT`);
  lines.push(divider);
  lines.push("");
  lines.push(`  Student:      ${child.name}`);
  lines.push(`  School Year:  ${year.label}`);
  lines.push(`  Period:       ${year.start_date} to ${year.end_date}`);
  lines.push(`  Generated:    ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
  lines.push("");
  lines.push(divider);
  lines.push(`  SUBJECT & CURRICULUM BREAKDOWN`);
  lines.push(divider);
  lines.push("");

  // Group by subject
  const subjects = new Map<
    string,
    { curriculum_name: string; total_lessons: number; completed_lessons: number; avg_grade: number | null }[]
  >();
  for (const row of rows) {
    const list = subjects.get(row.subject_name) || [];
    list.push(row);
    subjects.set(row.subject_name, list);
  }

  let totalLessons = 0;
  let totalCompleted = 0;
  const allGrades: number[] = [];

  for (const [subject, curricula] of subjects) {
    lines.push(`  ${subject.toUpperCase()}`);
    lines.push(subDivider);

    for (const c of curricula) {
      const pct =
        c.total_lessons > 0
          ? Math.round((c.completed_lessons / c.total_lessons) * 100)
          : 0;
      const grade =
        c.avg_grade && Number(c.avg_grade) > 0
          ? `${Number(c.avg_grade).toFixed(1)}%`
          : "N/A";

      lines.push(`    ${c.curriculum_name}`);
      lines.push(
        `      Lessons:  ${c.completed_lessons}/${c.total_lessons} completed (${pct}%)`
      );
      lines.push(`      Grade:    ${grade}`);
      lines.push("");

      totalLessons += c.total_lessons;
      totalCompleted += c.completed_lessons;
      if (c.avg_grade && Number(c.avg_grade) > 0) {
        allGrades.push(Number(c.avg_grade));
      }
    }
  }

  if (rows.length === 0) {
    lines.push("  No curricula assigned for this school year.");
    lines.push("");
  }

  lines.push(divider);
  lines.push(`  OVERALL STATISTICS`);
  lines.push(divider);
  lines.push("");
  lines.push(`  Total Subjects:     ${subjects.size}`);
  lines.push(`  Total Curricula:    ${rows.length}`);
  lines.push(`  Total Lessons:      ${totalLessons}`);
  lines.push(`  Completed Lessons:  ${totalCompleted}`);

  const overallPct =
    totalLessons > 0 ? Math.round((totalCompleted / totalLessons) * 100) : 0;
  lines.push(`  Completion Rate:    ${overallPct}%`);

  const overallAvg =
    allGrades.length > 0
      ? (allGrades.reduce((a, b) => a + b, 0) / allGrades.length).toFixed(1)
      : "N/A";
  lines.push(`  Overall Avg Grade:  ${overallAvg}${overallAvg !== "N/A" ? "%" : ""}`);
  lines.push("");
  lines.push(divider);

  const reportText = lines.join("\n");
  const filename = `${child.name.replace(/\s+/g, "_")}_${year.label.replace(/\s+/g, "_")}_Report.txt`;

  return new NextResponse(reportText, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
