export const dynamic = "force-dynamic";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import ProgressBar from "@/components/ui/ProgressBar";
import EmptyState from "@/components/ui/EmptyState";
import { getAllChildren } from "@/lib/queries/students";
import { getCurrentUser } from "@/lib/session";
export default async function StudentsPage() {
  const user = await getCurrentUser();
  const children = await getAllChildren(
    user.role === "parent" ? user.id : undefined,
  );
  return (
    <div>
      {" "}
      <PageHeader title="Students" />{" "}
      {children.length === 0 ? (
        <EmptyState message="No students added yet" icon="👨‍🎓" />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {" "}
          {children.map((child: Record<string, string | number>) => (
            <Link key={String(child.id)} href={`/students/${child.id}`}>
              {" "}
              <Card className="transition-shadow hover:shadow-md">
                {" "}
                <div className="mb-4 flex items-center gap-3">
                  {" "}
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-interactive-medium text-xl font-bold text-interactive">
                    {" "}
                    {child.emoji || String(child.name).charAt(0)}{" "}
                  </div>{" "}
                  <div>
                    {" "}
                    <h3 className="text-lg font-semibold">
                      {String(child.name)}
                    </h3>{" "}
                    <p className="text-sm text-muted">
                      {" "}
                      {child.subject_count} subjects{" "}
                    </p>{" "}
                  </div>{" "}
                </div>{" "}
                <div className="space-y-2">
                  {" "}
                  <div className="flex justify-between text-sm text-muted">
                    {" "}
                    <span>Lessons completed</span>{" "}
                    <span>
                      {" "}
                      {child.completed_lessons} / {child.total_lessons}{" "}
                    </span>{" "}
                  </div>{" "}
                  <ProgressBar
                    value={Number(child.completed_lessons)}
                    max={Number(child.total_lessons)}
                    color="success"
                  />{" "}
                </div>{" "}
              </Card>{" "}
            </Link>
          ))}{" "}
        </div>
      )}{" "}
    </div>
  );
}
