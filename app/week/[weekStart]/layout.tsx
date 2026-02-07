import { getChildren } from "@/lib/queries/week";
import ChildSelector from "@/components/week/ChildSelector";
import WeekNav from "@/components/week/WeekNav";
import Breadcrumbs from "@/components/week/Breadcrumbs";

export const dynamic = "force-dynamic";

export default async function WeekLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { weekStart: string };
}) {
  const childrenList = await getChildren();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Breadcrumbs />
        <div className="flex items-center gap-3">
          <WeekNav weekStart={params.weekStart} />
          {childrenList.length > 1 && (
            <ChildSelectorWrapper childrenList={childrenList} />
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

function ChildSelectorWrapper({
  childrenList,
}: {
  childrenList: { id: string; name: string }[];
}) {
  // ChildSelector reads child from searchParams on the client side
  return (
    <ChildSelector
      children={childrenList}
      defaultChildId={childrenList[0]?.id || ""}
    />
  );
}
