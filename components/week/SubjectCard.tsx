import Link from "next/link";
import ProgressBar from "@/components/ui/ProgressBar";
export default function SubjectCard({
  subjectId,
  subjectName,
  subjectColor,
  totalLessons,
  completedLessons,
  weekStart,
  date,
  childParam,
}: {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  totalLessons: number;
  completedLessons: number;
  weekStart: string;
  date: string;
  childParam: string;
}) {
  const allDone = completedLessons === totalLessons && totalLessons > 0;
  const qs = childParam ? `?child=${childParam}` : "";
  return (
    <Link
      href={`/week/${weekStart}/${date}/${subjectId}${qs}`}
      className={`block rounded-lg border p-3 transition-colors hover:border-interactive-border hover:shadow-sm ${allDone ? "border-success-200 bg-[var(--success-bg)]/50 dark:border-success-900/40/20" : "border-light bg-surface-slate"}`}
    >
      {" "}
      <div className="flex items-center gap-2">
        {" "}
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: subjectColor || "#6366f1" }}
        />{" "}
        <span className="text-sm font-medium text-primary">
          {subjectName}
        </span>{" "}
      </div>{" "}
      <div className="mt-2">
        {" "}
        <div className="mb-1 text-xs text-muted">
          {" "}
          {completedLessons}/{totalLessons} complete{" "}
        </div>{" "}
        <ProgressBar
          value={completedLessons}
          max={totalLessons}
          color={allDone ? "success" : "primary"}
          showLabel={false}
        />{" "}
      </div>{" "}
    </Link>
  );
}
