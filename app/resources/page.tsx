export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllResources } from "@/lib/queries/resources";
import { getAllBooklists } from "@/lib/queries/booklists";
import ResourcesClient from "@/components/resources/ResourcesClient";
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: { type?: string; search?: string; tag?: string };
}) {
  const type = searchParams.type || "";
  const search = searchParams.search || "";
  const tag = searchParams.tag || "";
  const [resources, booklists] = await Promise.all([
    getAllResources({
      type: type || undefined,
      search: search || undefined,
      tag: tag || undefined,
    }),
    getAllBooklists(),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="Resources" />{" "}
      <ResourcesClient
        resources={resources}
        booklists={booklists}
        initialTypeFilter={type}
        initialSearch={search}
        initialTagFilter={tag}
      />{" "}
    </div>
  );
}
