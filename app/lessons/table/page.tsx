export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllLessonsWithResources } from "@/lib/queries/lessons";
import { getAllResources } from "@/lib/queries/resources";
import EditableLessonsTable from "@/components/lessons/EditableLessonsTable";
import pool from "@/lib/db";
async function getCurriculaWithContext() {
  const res = await pool.query(
    `SELECT cu.id, cu.name, s.name AS subject_name, c.name AS child_name FROM curricula cu JOIN subjects s ON s.id = cu.subject_id JOIN curriculum_assignments ca ON ca.curriculum_id = cu.id JOIN children c ON c.id = ca.child_id ORDER BY c.name, s.name, cu.name`,
  );
  return res.rows;
}
export default async function LessonsTablePage() {
  const [lessons, resources, curricula] = await Promise.all([
    getAllLessonsWithResources(),
    getAllResources(),
    getCurriculaWithContext(),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="Lessons">
      </PageHeader>{" "}
      <EditableLessonsTable
        lessons={lessons}
        resources={resources.map(
          (r: { id: string; title: string; type: string }) => ({
            id: r.id,
            title: r.title,
            type: r.type,
          }),
        )}
        curricula={curricula}
      />{" "}
    </div>
  );
}
