import pool from "@/lib/db";

export async function getGradesByChild(childId: string, yearId?: string) {
  const yearFilter = yearId ? "AND ca.school_year_id = $2" : "";
  const params: string[] = [childId];
  if (yearId) params.push(yearId);

  const res = await pool.query(
    `SELECT
       lc.id AS completion_id,
       lc.grade,
       lc.notes,
       lc.completed_at,
       l.title AS lesson_title,
       l.id AS lesson_id,
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color,
       c.name AS child_name
     FROM lesson_completions lc
     JOIN lessons l ON l.id = lc.lesson_id
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN children c ON c.id = lc.child_id
     LEFT JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id AND ca.child_id = lc.child_id
     WHERE lc.child_id = $1 AND lc.grade IS NOT NULL ${yearFilter}
     ORDER BY lc.completed_at DESC`,
    params
  );
  return res.rows;
}

export async function getAllGrades() {
  const res = await pool.query(
    `SELECT
       lc.id AS completion_id,
       lc.grade,
       lc.notes,
       lc.completed_at,
       l.title AS lesson_title,
       l.id AS lesson_id,
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color,
       c.name AS child_name,
       c.id AS child_id
     FROM lesson_completions lc
     JOIN lessons l ON l.id = lc.lesson_id
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN children c ON c.id = lc.child_id
     WHERE lc.grade IS NOT NULL
     ORDER BY lc.completed_at DESC`
  );
  return res.rows;
}

export interface GradeTrendPoint {
  date: string;
  grade: number;
  lesson_title: string;
}

export interface SubjectTrend {
  subject_name: string;
  subject_color: string;
  child_name: string;
  child_id: string;
  grades: GradeTrendPoint[];
}

export async function getGradeTrends(): Promise<SubjectTrend[]> {
  const res = await pool.query(
    `SELECT
       s.name AS subject_name,
       s.color AS subject_color,
       c.name AS child_name,
       c.id AS child_id,
       lc.grade,
       lc.completed_at::date AS date,
       l.title AS lesson_title
     FROM lesson_completions lc
     JOIN lessons l ON l.id = lc.lesson_id
     JOIN curricula cu ON cu.id = l.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN children c ON c.id = lc.child_id
     WHERE lc.grade IS NOT NULL
     ORDER BY c.name, s.name, lc.completed_at`
  );

  // Group rows into SubjectTrend objects (per child + subject)
  const map = new Map<string, SubjectTrend>();
  for (const row of res.rows) {
    const key = `${row.child_id}-${row.subject_name}`;
    if (!map.has(key)) {
      map.set(key, {
        subject_name: row.subject_name,
        subject_color: row.subject_color,
        child_name: row.child_name,
        child_id: row.child_id,
        grades: [],
      });
    }
    map.get(key)!.grades.push({
      date: row.date,
      grade: Number(row.grade),
      lesson_title: row.lesson_title,
    });
  }

  return Array.from(map.values());
}

export async function getGradeSummary(childId: string, yearId?: string) {
  const yearFilter = yearId ? "AND ca.school_year_id = $2" : "";
  const params: string[] = [childId];
  if (yearId) params.push(yearId);

  const res = await pool.query(
    `SELECT
       s.id AS subject_id,
       s.name AS subject_name,
       s.color AS subject_color,
       COUNT(lc.id)::int AS graded_count,
       COALESCE(AVG(lc.grade), 0)::numeric(5,2) AS avg_grade,
       COALESCE(MIN(lc.grade), 0)::numeric(5,2) AS min_grade,
       COALESCE(MAX(lc.grade), 0)::numeric(5,2) AS max_grade
     FROM curriculum_assignments ca
     JOIN curricula cu ON cu.id = ca.curriculum_id
     JOIN subjects s ON s.id = cu.subject_id
     JOIN lessons l ON l.curriculum_id = cu.id
     LEFT JOIN lesson_completions lc ON lc.lesson_id = l.id AND lc.child_id = $1 AND lc.grade IS NOT NULL
     WHERE ca.child_id = $1 ${yearFilter}
     GROUP BY s.id, s.name, s.color
     ORDER BY s.name`,
    params
  );
  return res.rows;
}
