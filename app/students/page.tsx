export const dynamic = "force-dynamic";
import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import EmptyState from "@/components/ui/EmptyState";
import { getAllChildren, getChildRoster } from "@/lib/queries/students";
import { getCurrentUser } from "@/lib/session";
import { kidColorMap } from "@/lib/utils/kid-colors";

export default async function StudentsPage() {
  const user = await getCurrentUser();
  const [children, roster] = await Promise.all([
    getAllChildren(user.role === "parent" ? user.id : undefined),
    getChildRoster(),
  ]);
  const colors = kidColorMap(roster);

  const totalLessons = children.reduce(
    (sum: number, child: Record<string, number>) =>
      sum + Number(child.total_lessons || 0),
    0,
  );
  const totalDone = children.reduce(
    (sum: number, child: Record<string, number>) =>
      sum + Number(child.completed_lessons || 0),
    0,
  );
  const overall =
    totalLessons > 0 ? Math.round((totalDone / totalLessons) * 100) : 0;

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle={
          children.length === 0
            ? "No students yet"
            : `${children.length} ${children.length === 1 ? "student" : "students"} · ${overall}% of assigned work complete`
        }
      />
      {children.length === 0 ? (
        <div className="rounded-card border border-light bg-surface shadow-warm">
          <EmptyState
            message="Add your first student"
            hint="Students hold the courses, grades, reading, and attendance you track."
            ornament="seedling"
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((child: Record<string, string | number>) => {
            const id = String(child.id);
            const color = colors[id];
            const total = Number(child.total_lessons) || 0;
            const done = Number(child.completed_lessons) || 0;
            const percent = total > 0 ? Math.round((done / total) * 100) : 0;
            return (
              <Link
                key={id}
                href={`/students/${id}`}
                className="rounded-card border border-light bg-surface p-4 shadow-warm transition-shadow hover:shadow-warm-md"
                style={{
                  borderTop: `3px solid ${color?.solid ?? "var(--interactive)"}`,
                }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 items-center justify-center rounded-full font-display text-lg"
                    style={{
                      backgroundColor: color?.bg,
                      color: color?.text,
                    }}
                  >
                    {child.emoji || String(child.name).charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg text-primary">
                      {String(child.name)}
                    </h2>
                    <p className="text-xs text-muted">
                      {child.subject_count}{" "}
                      {Number(child.subject_count) === 1
                        ? "subject"
                        : "subjects"}
                    </p>
                  </div>
                  <span className="ml-auto text-sm text-tertiary">
                    {percent}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-subtle">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${percent}%`,
                      backgroundColor: color?.solid ?? "var(--interactive)",
                    }}
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">
                  {done} of {total} lessons
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
