export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import { getAllCurricula } from "@/lib/queries/admin";
import { getAllChildren } from "@/lib/queries/students";
import AdminCurriculaClient from "./AdminCurriculaClient";

export default async function AdminCurriculaPage() {
  const [curricula, children] = await Promise.all([
    getAllCurricula(),
    getAllChildren(),
  ]);

  return (
    <div>
      <PageHeader title="Manage Courses" />
      <AdminCurriculaClient curricula={curricula} children={children} />
    </div>
  );
}
