export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import { getAllCurricula } from "@/lib/queries/curricula";
import { getAllChildren } from "@/lib/queries/students";
import { getAllSubjects } from "@/lib/queries/subjects";
import { getSchoolYears } from "@/lib/queries/calendar";
import CurriculaView from "@/components/curricula/CurriculaView";
import NewCurriculumButton from "@/components/curricula/NewCurriculumButton";

export default async function CurriculaPage() {
  const [curricula, childrenData, subjectsData, schoolYears] = await Promise.all([
    getAllCurricula(),
    getAllChildren(),
    getAllSubjects(),
    getSchoolYears(),
  ]);

  const children = childrenData.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));

  const subjects = subjectsData.map(
    (s: { id: string; name: string }) => ({
      id: s.id,
      name: s.name,
    })
  );

  const years = schoolYears.map((y: { id: string; label: string }) => ({
    id: y.id,
    label: y.label,
  }));

  return (
    <div>
      <PageHeader title="Courses">
        <NewCurriculumButton children={children} schoolYears={years} />
      </PageHeader>

      <CurriculaView curricula={curricula} children={children} subjects={subjects} />
    </div>
  );
}
