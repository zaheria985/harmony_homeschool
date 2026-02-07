export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import { ViewToggleNav } from "@/components/ui/ViewToggle";
import { getAllLessons } from "@/lib/queries/lessons";
import { getAllChildren } from "@/lib/queries/students";
import NewLessonButton from "@/components/lessons/NewLessonButton";
import LessonsTable from "@/components/lessons/LessonsTable";

const VIEW_OPTIONS = [
  { key: "card", label: "Card", href: "/lessons" },
  { key: "table", label: "Table", href: "/lessons/table" },
];

export default async function LessonsPage() {
  const [lessons, childrenData] = await Promise.all([
    getAllLessons(),
    getAllChildren(),
  ]);
  const children = childrenData.map((c: { id: string; name: string }) => ({
    id: c.id,
    name: c.name,
  }));

  return (
    <div>
      <PageHeader title="Lessons">
        <ViewToggleNav options={VIEW_OPTIONS} />
        <NewLessonButton children={children} />
      </PageHeader>

      <LessonsTable lessons={lessons} children={children} />
    </div>
  );
}
