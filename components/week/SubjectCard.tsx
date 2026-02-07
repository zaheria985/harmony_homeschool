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
      className={`block rounded-lg border p-3 transition-colors hover:border-primary-300 hover:shadow-sm ${
        allDone ? "border-success-200 bg-success-50/50" : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className="h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: subjectColor || "#6366f1" }}
        />
        <span className="text-sm font-medium text-gray-900">{subjectName}</span>
      </div>
      <div className="mt-2">
        <div className="mb-1 text-xs text-gray-500">
          {completedLessons}/{totalLessons} complete
        </div>
        <ProgressBar
          value={completedLessons}
          max={totalLessons}
          color={allDone ? "success" : "primary"}
          showLabel={false}
        />
      </div>
    </Link>
  );
}
