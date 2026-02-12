export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllSubjects } from "@/lib/queries/admin";
import AdminSubjectsClient from "./AdminSubjectsClient";
export default async function AdminSubjectsPage() {
  const subjects = await getAllSubjects();
  return (
    <div>
      {" "}
      <PageHeader title="Manage Subjects" />{" "}
      <AdminSubjectsClient subjects={subjects} />{" "}
    </div>
  );
}
