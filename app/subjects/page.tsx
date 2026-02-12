export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllSubjects } from "@/lib/queries/subjects";
import { getAllChildren } from "@/lib/queries/students";
import SubjectsView from "@/components/subjects/SubjectsView";
import NewSubjectButton from "@/components/subjects/NewSubjectButton";
import { getCurrentUser } from "@/lib/session";
export default async function SubjectsPage() {
  const user = await getCurrentUser();
  const [subjects, children] = await Promise.all([
    getAllSubjects(),
    getAllChildren(user.role === "parent" ? user.id : undefined),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="Subjects">
        {" "}
        <NewSubjectButton />{" "}
      </PageHeader>{" "}
      <SubjectsView
        subjects={subjects}
        children={children.map((c: { id: string; name: string }) => ({
          id: c.id,
          name: c.name,
        }))}
      />{" "}
    </div>
  );
}
