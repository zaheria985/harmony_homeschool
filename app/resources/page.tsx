export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllResources, getResourceUsageStats } from "@/lib/queries/resources";
import { getAllBooklists } from "@/lib/queries/booklists";
import ResourcesClient from "@/components/resources/ResourcesClient";
import ResourceUsageStats from "@/components/resources/ResourceUsageStats";
export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: { type?: string; search?: string; tag?: string; category?: string };
}) {
  const type = searchParams.type || "";
  const search = searchParams.search || "";
  const tag = searchParams.tag || "";
  const category = searchParams.category || "learning";
  const [resources, booklists, usageStats] = await Promise.all([
    getAllResources({
      type: type || undefined,
      search: search || undefined,
      tag: tag || undefined,
      category: category === "all" ? undefined : category,
    }),
    getAllBooklists(),
    getResourceUsageStats(),
  ]);
  return (
    <div>
      <PageHeader title="Resources" />
      <ResourcesClient
        resources={resources}
        booklists={booklists}
        initialTypeFilter={type}
        initialSearch={search}
        initialTagFilter={tag}
        initialCategory={category}
      />
      <ResourceUsageStats stats={usageStats} />
    </div>
  );
}
