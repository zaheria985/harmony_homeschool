export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllCurricula } from "@/lib/queries/curricula";
import { getAllChildren } from "@/lib/queries/students";
import { getAllSubjects } from "@/lib/queries/subjects";
import { getSchoolYears } from "@/lib/queries/calendar";
import { getAllTagNames } from "@/lib/queries/resources";
import CurriculaView from "@/components/curricula/CurriculaView";
import NewCurriculumButton from "@/components/curricula/NewCurriculumButton";
import ImportCurriculumModal from "@/components/curricula/ImportCurriculumModal";
import { getCurrentUser } from "@/lib/session";
export default async function CurriculaPage() {
  const user = await getCurrentUser();
  const [curricula, childrenData, subjectsData, schoolYears, allTags] =
    await Promise.all([
      getAllCurricula(),
      getAllChildren(user.role === "parent" ? user.id : undefined),
      getAllSubjects(),
      getSchoolYears(),
      getAllTagNames(),
    ]);
  const children = childrenData.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));
  const subjects = subjectsData.map((s: { id: string; name: string; color: string | null }) => ({
    id: s.id,
    name: s.name,
    color: s.color || undefined,
  }));
  const years = schoolYears.map((y: { id: string; label: string }) => ({
    id: y.id,
    label: y.label,
  }));
  return (
    <div>
      {" "}
      <PageHeader title="Courses">
        {" "}
        <div className="flex items-center gap-2">
          <ImportCurriculumModal subjects={subjects} />
          <NewCurriculumButton children={children} schoolYears={years} />
        </div>{" "}
      </PageHeader>{" "}
      <CurriculaView
        curricula={curricula}
        children={children}
        subjects={subjects}
        allTags={allTags}
        permissionLevel={user.permissionLevel}
      />{" "}
    </div>
  );
}
