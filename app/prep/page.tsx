export const dynamic = "force-dynamic";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import PrepMaterialsView, {
  type PrepMaterial,
} from "@/components/prep/PrepMaterialsView";
import { getAllChildren } from "@/lib/queries/students";
import { getUpcomingPrepMaterials } from "@/lib/queries/prep";
import { getCurrentUser } from "@/lib/session";
export default async function PrepPage({
  searchParams,
}: {
  searchParams: { child?: string };
}) {
  const user = await getCurrentUser();
  const selectedChildId = searchParams.child || "";
  const [children, materials] = await Promise.all([
    getAllChildren(user.role === "parent" ? user.id : undefined),
    getUpcomingPrepMaterials(7, selectedChildId || undefined),
  ]);
  return (
    <div>
      {" "}
      <PageHeader title="Weekly Prep" />{" "}
      <div className="mb-4 flex items-center gap-2">
        {" "}
        <a
          href="/prep"
          className="rounded-lg border border-border px-3 py-2 text-sm text-tertiary hover:bg-surface-muted"
        >
          {" "}
          All Students{" "}
        </a>{" "}
        {children.map((child: Record<string, string>) => (
          <a
            key={child.id}
            href={`/prep?child=${child.id}`}
            className={`rounded-lg border border-border px-3 py-2 text-sm hover:bg-surface-muted ${selectedChildId === child.id ? "border-interactive-border bg-interactive-light text-interactive-hover/20 dark:text-primary-200" : "text-tertiary"}`}
          >
            {" "}
            {child.name}{" "}
          </a>
        ))}{" "}
      </div>{" "}
      {(materials as PrepMaterial[]).length === 0 ? (
        <Card title="Upcoming Materials">
          {" "}
          <p className="text-sm text-muted">
            No upcoming supply/book materials in the next 7 days.
          </p>{" "}
        </Card>
      ) : (
        <PrepMaterialsView materials={materials as PrepMaterial[]} />
      )}{" "}
    </div>
  );
}
