export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import AdminTagsClient from "@/components/tags/AdminTagsClient";
import pool from "@/lib/db";
async function getTags() {
  const res = await pool.query(
    `SELECT t.id, t.name, COUNT(rt.resource_id)::int AS resource_count FROM tags t LEFT JOIN resource_tags rt ON rt.tag_id = t.id GROUP BY t.id, t.name ORDER BY t.name`,
  );
  return res.rows;
}
export default async function AdminTagsPage() {
  const tags = await getTags();
  return (
    <div>
      {" "}
      <PageHeader title="Tag Management" /> <AdminTagsClient tags={tags} />{" "}
    </div>
  );
}
