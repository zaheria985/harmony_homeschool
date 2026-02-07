export const dynamic = "force-dynamic";

import PageHeader from "@/components/ui/PageHeader";
import { getAllChildren } from "@/lib/queries/students";
import CalendarView from "./CalendarView";

export default async function CalendarPage() {
  const children = await getAllChildren();

  return (
    <div>
      <PageHeader title="Calendar" />
      <CalendarView
        children={children.map((c: Record<string, string>) => ({
          id: c.id,
          name: c.name,
        }))}
      />
    </div>
  );
}
