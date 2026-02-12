export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import pool from "@/lib/db";
import AdminBulkPasteClient from "./AdminBulkPasteClient";
async function getCurriculaWithContext() {
  const res = await pool.query(
    `SELECT cu.id, cu.name, s.name AS subject_name, c.name AS child_name FROM curricula cu JOIN subjects s ON s.id = cu.subject_id JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id JOIN children c ON c.id = ca.child_id ORDER BY c.name, s.name, cu.name`,
  );
  return res.rows as Array<{
    id: string;
    name: string;
    subject_name: string;
    child_name: string;
  }>;
}
async function getChildren() {
  const res = await pool.query(`SELECT id, name FROM children ORDER BY name`);
  return res.rows as Array<{ id: string; name: string }>;
}
async function getSchoolYears() {
  const res = await pool.query(
    `SELECT id, label, start_date::text AS start_date, end_date::text AS end_date FROM school_years ORDER BY start_date DESC`,
  );
  return res.rows as Array<{
    id: string;
    label: string;
    start_date: string;
    end_date: string;
  }>;
}
export default async function AdminLessonsPage() {
  const [curricula, children, schoolYears] = await Promise.all([
    getCurriculaWithContext(),
    getChildren(),
    getSchoolYears(),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="Bulk Import Lessons" />{" "}
      <AdminBulkPasteClient
        curricula={curricula}
        children={children}
        schoolYears={schoolYears}
      />{" "}
    </div>
  );
}
