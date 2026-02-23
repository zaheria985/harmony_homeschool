export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import TagsClient from "@/components/tags/TagsClient";
import { getAllResourceTags } from "@/lib/queries/resources";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function TagsPage() {
  const [tags, session] = await Promise.all([
    getAllResourceTags(),
    getServerSession(authOptions),
  ]);
  const role = (session?.user as { role?: string } | undefined)?.role || "parent";
  return (
    <div>
      <PageHeader title="Tags" />
      <TagsClient tags={tags} userRole={role} />
    </div>
  );
}
