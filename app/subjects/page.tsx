export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import { getAllSubjects } from "@/lib/queries/subjects";
import SubjectsView from "@/components/subjects/SubjectsView";
import NewSubjectButton from "@/components/subjects/NewSubjectButton";

export default async function SubjectsPage() {
  const subjects = await getAllSubjects();

  return (
    <div>
      <PageHeader title="Subjects">
        <NewSubjectButton />
      </PageHeader>

      <SubjectsView subjects={subjects} />
    </div>
  );
}
