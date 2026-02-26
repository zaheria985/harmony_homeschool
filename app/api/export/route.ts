import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;
  if (!user || user.role === "kid") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const format = request.nextUrl.searchParams.get("format") || "json";

  const [
    children,
    subjects,
    curricula,
    lessons,
    completions,
    resources,
    books,
    tags,
  ] = await Promise.all([
    pool.query("SELECT id, name, avatar_emoji, created_at FROM children ORDER BY name"),
    pool.query("SELECT id, name, color FROM subjects ORDER BY name"),
    pool.query(
      `SELECT cu.id, cu.name, cu.description, cu.course_type, cu.grade_type, cu.status,
              cu.start_date::text, cu.end_date::text, s.name AS subject_name
       FROM curricula cu LEFT JOIN subjects s ON s.id = cu.subject_id
       ORDER BY cu.name`
    ),
    pool.query(
      `SELECT l.id, l.title, l.status, l.planned_date::text, l.description, l.section,
              cu.name AS curriculum_name
       FROM lessons l LEFT JOIN curricula cu ON cu.id = l.curriculum_id
       ORDER BY l.planned_date NULLS LAST, l.order_index`
    ),
    pool.query(
      `SELECT lc.lesson_id, c.name AS child_name, lc.grade, lc.pass_fail,
              lc.completed_at::text, lc.notes
       FROM lesson_completions lc JOIN children c ON c.id = lc.child_id
       ORDER BY lc.completed_at DESC`
    ),
    pool.query(
      `SELECT id, title, type, author, url, description, created_at::text
       FROM resources ORDER BY title`
    ),
    pool.query(
      `SELECT r.id, r.title, r.author, r.thumbnail_url,
              COALESCE(bl.name, 'Unassigned') AS booklist_name
       FROM resources r
       LEFT JOIN booklist_resources br ON br.resource_id = r.id
       LEFT JOIN booklists bl ON bl.id = br.booklist_id
       WHERE r.type = 'book'
       ORDER BY r.title`
    ),
    pool.query("SELECT id, name FROM tags ORDER BY name"),
  ]);

  const data = {
    exported_at: new Date().toISOString(),
    children: children.rows,
    subjects: subjects.rows,
    curricula: curricula.rows,
    lessons: lessons.rows,
    completions: completions.rows,
    resources: resources.rows,
    books: books.rows,
    tags: tags.rows,
  };

  if (format === "csv") {
    const lines: string[] = [];
    lines.push("# Harmony Homeschool Data Export");
    lines.push(`# Exported: ${data.exported_at}`);
    lines.push("");

    for (const [tableName, rows] of Object.entries(data)) {
      if (tableName === "exported_at") continue;
      const tableRows = rows as Record<string, unknown>[];
      if (tableRows.length === 0) continue;
      lines.push(`## ${tableName}`);
      const headers = Object.keys(tableRows[0]);
      lines.push(headers.join(","));
      for (const row of tableRows) {
        lines.push(
          headers.map((h) => {
            const val = row[h];
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          }).join(",")
        );
      }
      lines.push("");
    }

    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="harmony-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  }

  return NextResponse.json(data, {
    headers: {
      "Content-Disposition": `attachment; filename="harmony-export-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
