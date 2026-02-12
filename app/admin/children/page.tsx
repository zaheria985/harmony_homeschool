export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllChildren } from "@/lib/queries/students";
import AdminChildrenClient from "./AdminChildrenClient";
import { getCurrentUser } from "@/lib/session";
export default async function AdminChildrenPage() {
  const user = await getCurrentUser();
  const children = await getAllChildren(
    user.role === "parent" ? user.id : undefined,
  );
  return (
    <div>
      {" "}
      <PageHeader title="Manage Children" />{" "}
      <AdminChildrenClient children={children} />{" "}
    </div>
  );
}
