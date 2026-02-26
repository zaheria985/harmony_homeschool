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

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing curriculum id" }, { status: 400 });
  }

  // Fetch curriculum with subject name
  const currRes = await pool.query(
    `SELECT cu.id, cu.name, cu.description, cu.cover_image, cu.course_type, cu.grade_type,
            s.name AS subject_name
     FROM curricula cu
     LEFT JOIN subjects s ON s.id = cu.subject_id
     WHERE cu.id = $1`,
    [id]
  );

  if (currRes.rows.length === 0) {
    return NextResponse.json({ error: "Curriculum not found" }, { status: 404 });
  }

  const curriculum = currRes.rows[0];

  // Fetch lessons
  const lessonsRes = await pool.query(
    `SELECT l.title, l.description, l.order_index, l.section, l.estimated_duration
     FROM lessons l
     WHERE l.curriculum_id = $1 AND l.archived = false
     ORDER BY l.order_index, l.planned_date ASC NULLS LAST`,
    [id]
  );

  // Fetch lesson resources (global resources linked to lessons)
  const resourcesRes = await pool.query(
    `SELECT DISTINCT r.title, r.type, r.url, r.author, r.description
     FROM lesson_resources lr
     JOIN resources r ON r.id = lr.resource_id
     WHERE lr.lesson_id IN (
       SELECT l.id FROM lessons l WHERE l.curriculum_id = $1 AND l.archived = false
     )
     AND lr.resource_id IS NOT NULL
     ORDER BY r.title`,
    [id]
  );

  // Fetch curriculum-level resources
  const currResourcesRes = await pool.query(
    `SELECT r.title, r.type, r.url, r.author, r.description
     FROM curriculum_resources cr
     JOIN resources r ON r.id = cr.resource_id
     WHERE cr.curriculum_id = $1
     ORDER BY r.title`,
    [id]
  );

  const exportData = {
    harmony_curriculum_export: true,
    exported_at: new Date().toISOString(),
    name: curriculum.name,
    subject_name: curriculum.subject_name,
    description: curriculum.description,
    cover_image: curriculum.cover_image,
    course_type: curriculum.course_type,
    grade_type: curriculum.grade_type,
    lessons: lessonsRes.rows.map((l: { title: string; description: string | null; order_index: number; section: string | null; estimated_duration: number | null }) => ({
      title: l.title,
      description: l.description,
      order_index: l.order_index,
      section: l.section,
      estimated_duration: l.estimated_duration,
    })),
    resources: resourcesRes.rows.map((r: { title: string; type: string; url: string; author: string | null; description: string | null }) => ({
      title: r.title,
      type: r.type,
      url: r.url,
      author: r.author,
      description: r.description,
    })),
    curriculum_resources: currResourcesRes.rows.map((r: { title: string; type: string; url: string; author: string | null; description: string | null }) => ({
      title: r.title,
      type: r.type,
      url: r.url,
      author: r.author,
      description: r.description,
    })),
  };

  const safeName = curriculum.name.replace(/[^a-zA-Z0-9_-]/g, "_").toLowerCase();

  return NextResponse.json(exportData, {
    headers: {
      "Content-Disposition": `attachment; filename="curriculum-${safeName}.json"`,
    },
  });
}
