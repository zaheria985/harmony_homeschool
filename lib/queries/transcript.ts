import pool from "@/lib/db";

/**
 * Transcript data: one row per course the child was assigned, with the final
 * grade derived from their completed lessons.
 *
 * Grade handling follows the curriculum's `grade_type`:
 *   - numeric   → average of recorded numeric grades
 *   - pass_fail → Pass when every completed lesson passed
 *   - combo     → numeric average when grades exist, else pass/fail
 */

export type TranscriptCourse = {
  curriculumId: string;
  courseName: string;
  subjectName: string;
  yearLabel: string;
  gradeType: "numeric" | "pass_fail" | "combo";
  numericGrade: number | null;
  passFail: string | null;
  credits: number | null;
  lessonsCompleted: number;
  lessonsTotal: number;
};

export type Transcript = {
  childId: string;
  childName: string;
  courses: TranscriptCourse[];
  totalCredits: number;
  gpa: number | null;
};

/** Standard 4.0 scale from a percentage. */
export function gradePointsFromPercent(percent: number): number {
  if (percent >= 90) return 4;
  if (percent >= 80) return 3;
  if (percent >= 70) return 2;
  if (percent >= 60) return 1;
  return 0;
}

export function letterFromPercent(percent: number): string {
  if (percent >= 90) return "A";
  if (percent >= 80) return "B";
  if (percent >= 70) return "C";
  if (percent >= 60) return "D";
  return "F";
}

export async function getTranscript(
  childId: string,
  yearIds?: string[],
): Promise<Transcript | null> {
  const childRes = await pool.query(
    "SELECT id::text, name FROM children WHERE id = $1",
    [childId],
  );
  const child = childRes.rows[0];
  if (!child) return null;

  const filterYears = yearIds && yearIds.length > 0;

  const res = await pool.query(
    `SELECT
       cu.id::text        AS curriculum_id,
       cu.name            AS course_name,
       cu.grade_type,
       cu.credits,
       s.name             AS subject_name,
       sy.label           AS year_label,
       COUNT(l.id)::int                                        AS lessons_total,
       COUNT(lc.id)::int                                       AS lessons_completed,
       AVG(lc.grade) FILTER (WHERE lc.grade IS NOT NULL)        AS avg_grade,
       COUNT(*) FILTER (WHERE lc.pass_fail = 'fail')::int       AS fail_count,
       COUNT(*) FILTER (WHERE lc.pass_fail IS NOT NULL)::int    AS pass_fail_count
     FROM curriculum_assignments ca
     JOIN curricula cu ON cu.id = ca.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN school_years sy ON sy.id = ca.school_year_id
     LEFT JOIN lessons l ON l.curriculum_id = cu.id AND l.archived = false
     LEFT JOIN lesson_completions lc
       ON lc.lesson_id = l.id AND lc.child_id = ca.child_id
     WHERE ca.child_id = $1
       AND ($2::boolean = false OR ca.school_year_id = ANY($3::uuid[]))
     GROUP BY cu.id, cu.name, cu.grade_type, cu.credits, s.name, sy.label, sy.start_date
     ORDER BY sy.start_date, s.name, cu.name`,
    [childId, filterYears, filterYears ? yearIds : []],
  );

  const courses: TranscriptCourse[] = (res.rows as {
    curriculum_id: string;
    course_name: string;
    grade_type: "numeric" | "pass_fail" | "combo";
    credits: string | null;
    subject_name: string;
    year_label: string;
    lessons_total: number;
    lessons_completed: number;
    avg_grade: string | null;
    fail_count: number;
    pass_fail_count: number;
  }[]).map((row) => {
    const avg = row.avg_grade === null ? null : Number(row.avg_grade);
    const hasNumeric = avg !== null && Number.isFinite(avg);

    let numericGrade: number | null = null;
    let passFail: string | null = null;

    if (row.grade_type === "numeric") {
      numericGrade = hasNumeric ? Math.round(avg * 10) / 10 : null;
    } else if (row.grade_type === "pass_fail") {
      if (row.pass_fail_count > 0) {
        passFail = row.fail_count > 0 ? "Fail" : "Pass";
      }
    } else {
      // combo: prefer a numeric average, fall back to pass/fail
      if (hasNumeric) numericGrade = Math.round(avg * 10) / 10;
      else if (row.pass_fail_count > 0) {
        passFail = row.fail_count > 0 ? "Fail" : "Pass";
      }
    }

    return {
      curriculumId: row.curriculum_id,
      courseName: row.course_name,
      subjectName: row.subject_name,
      yearLabel: row.year_label,
      gradeType: row.grade_type,
      numericGrade,
      passFail,
      credits: row.credits === null ? null : Number(row.credits),
      lessonsCompleted: row.lessons_completed,
      lessonsTotal: row.lessons_total,
    };
  });

  // GPA over graded courses that carry credit; unweighted when credits are unset.
  let weightedPoints = 0;
  let creditSum = 0;
  let gradedCount = 0;
  let plainPoints = 0;

  for (const course of courses) {
    if (course.numericGrade === null) continue;
    const points = gradePointsFromPercent(course.numericGrade);
    gradedCount += 1;
    plainPoints += points;
    if (course.credits && course.credits > 0) {
      weightedPoints += points * course.credits;
      creditSum += course.credits;
    }
  }

  const gpa =
    creditSum > 0
      ? Math.round((weightedPoints / creditSum) * 100) / 100
      : gradedCount > 0
        ? Math.round((plainPoints / gradedCount) * 100) / 100
        : null;

  const totalCredits = courses.reduce(
    (sum, course) => sum + (course.credits ?? 0),
    0,
  );

  return {
    childId: child.id,
    childName: child.name,
    courses,
    totalCredits: Math.round(totalCredits * 100) / 100,
    gpa,
  };
}
