export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import { getAllResources } from "@/lib/queries/resources";
import ResourcesClient from "@/components/resources/ResourcesClient";

export default async function ResourcesPage() {
  const resources = await getAllResources();

  return (
    <div>
      <PageHeader title="Resources" />
      <ResourcesClient resources={resources} />
    </div>
  );
}
