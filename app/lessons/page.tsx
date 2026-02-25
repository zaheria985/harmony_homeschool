export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";

import { getAllLessons } from "@/lib/queries/lessons";
import { getAllChildren } from "@/lib/queries/students";
import NewLessonButton from "@/components/lessons/NewLessonButton";
import LessonsTable from "@/components/lessons/LessonsTable";
import { getCurrentUser } from "@/lib/session";

export default async function LessonsPage() {
  const user = await getCurrentUser();
  const [lessons, childrenData] = await Promise.all([
    getAllLessons(),
    getAllChildren(user.role === "parent" ? user.id : undefined),
  ]);
  const children = childrenData.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));
  return (
    <div>
      {" "}
      <PageHeader title="Lessons">
        {" "}
        <NewLessonButton children={children} />{" "}
      </PageHeader>{" "}
      <LessonsTable lessons={lessons} children={children} />{" "}
    </div>
  );
}
