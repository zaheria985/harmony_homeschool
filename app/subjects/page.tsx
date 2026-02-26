export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllSubjects } from "@/lib/queries/subjects";
import { getAllChildren } from "@/lib/queries/students";
import SubjectsView from "@/components/subjects/SubjectsView";
import NewSubjectButton from "@/components/subjects/NewSubjectButton";
import SubjectTemplateButton from "@/components/subjects/SubjectTemplateButton";
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
        <div className="flex items-center gap-2">
          <SubjectTemplateButton />
          <NewSubjectButton />
        </div>
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
