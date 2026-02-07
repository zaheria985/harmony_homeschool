export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import { getAllChildren } from "@/lib/queries/students";
import AdminChildrenClient from "./AdminChildrenClient";

export default async function AdminChildrenPage() {
  const children = await getAllChildren();

  return (
    <div>
      <PageHeader title="Manage Children" />
      <AdminChildrenClient children={children} />
    </div>
  );
}
