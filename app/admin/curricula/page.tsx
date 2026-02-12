export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllCurricula } from "@/lib/queries/admin";
import { getAllChildren } from "@/lib/queries/students";
import AdminCurriculaClient from "./AdminCurriculaClient";
import { getCurrentUser } from "@/lib/session";
export default async function AdminCurriculaPage() {
  const user = await getCurrentUser();
  const [curricula, children] = await Promise.all([
    getAllCurricula(),
    getAllChildren(user.role === "parent" ? user.id : undefined),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="Manage Courses" />{" "}
      <AdminCurriculaClient curricula={curricula} children={children} />{" "}
    </div>
  );
}
