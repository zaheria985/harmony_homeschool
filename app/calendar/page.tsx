export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import { getAllChildren } from "@/lib/queries/students";
import CalendarView from "./CalendarView";
import { getCurrentUser } from "@/lib/session";
export default async function CalendarPage() {
  const user = await getCurrentUser();
  const children = await getAllChildren(
    user.role === "parent" ? user.id : undefined,
  );
  const filteredChildren =
    user.role === "kid" && user.childId
      ? children.filter(
          (child: Record<string, string>) => child.id === user.childId,
        )
      : children;
  return (
    <div>
      {" "}
      <PageHeader title="Calendar" />{" "}
      <CalendarView
        children={filteredChildren.map((c: Record<string, string>) => ({
          id: c.id,
          name: c.name,
        }))}
        forcedChildId={user.role === "kid" ? user.childId || "" : ""}
        readOnly={user.role === "kid"}
      />{" "}
    </div>
  );
}
