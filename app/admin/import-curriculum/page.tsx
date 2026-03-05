export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import pool from "@/lib/db";
import CurriculumImportClient from "./CurriculumImportClient";

export default async function CurriculumImportPage() {
  const [subjectsRes, childrenRes, yearsRes] = await Promise.all([
    pool.query(`SELECT id, name, color FROM subjects ORDER BY name`),
    pool.query(`SELECT id, name FROM children ORDER BY name`),
    pool.query(
      `SELECT id, label, start_date::text AS start_date, end_date::text AS end_date
       FROM school_years
       ORDER BY start_date DESC`
    ),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="Import Curriculum" />
      <CurriculumImportClient
        subjects={subjectsRes.rows}
        children={childrenRes.rows}
        schoolYears={yearsRes.rows}
      />
    </div>
  );
}
