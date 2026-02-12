import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import pool from "@/lib/db";
import { getAssignmentDaysForCurriculum } from "@/lib/queries/curricula";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const curriculumId = params.id;
  if (!curriculumId) {
    return NextResponse.json({ error: "Missing curriculum id" }, { status: 400 });
  }

  const [assignments, unscheduledRes] = await Promise.all([
    getAssignmentDaysForCurriculum(curriculumId),
    pool.query(
      `SELECT COUNT(*)::int AS unscheduled_count
       FROM lessons
       WHERE curriculum_id = $1
         AND planned_date IS NULL
         AND status != 'completed'`,
      [curriculumId],
    ),
  ]);

  const normalizedAssignments = assignments.map((assignment) => ({
    assignmentId: assignment.assignment_id,
    childId: assignment.child_id,
    childName: assignment.child_name,
    configuredWeekdays: assignment.configured_weekdays,
    schoolWeekdays: assignment.school_weekdays,
  }));

  return NextResponse.json({
    assignments: normalizedAssignments,
    unscheduledCount: unscheduledRes.rows[0]?.unscheduled_count || 0,
  });
}
