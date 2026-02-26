export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import pool from "@/lib/db";

export default async function CurriculumDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const res = await pool.query(
    `SELECT default_view FROM curricula WHERE id = $1`,
    [params.id]
  );
  const view = res.rows[0]?.default_view || "board";
  redirect(`/curricula/${params.id}/${view}`);
}
