export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import TagsClient from "@/components/tags/TagsClient";
import { getAllResourceTags } from "@/lib/queries/resources";
export default async function TagsPage() {
  const tags = await getAllResourceTags();
  return (
    <div>
      {" "}
      <PageHeader title="Tags" /> <TagsClient tags={tags} />{" "}
    </div>
  );
}
