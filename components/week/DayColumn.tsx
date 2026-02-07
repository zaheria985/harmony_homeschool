import Link from "next/link";
import SubjectCard from "./SubjectCard";
import { formatWeekdayShort, formatShortDate, isToday } from "@/lib/utils/dates";

interface SubjectSummary {
  subjectId: string;
  subjectName: string;
  subjectColor: string | null;
  totalLessons: number;
  completedLessons: number;
}

export default function DayColumn({
  date,
  weekStart,
  subjects,
  childParam,
}: {
  date: string;
  weekStart: string;
  subjects: SubjectSummary[];
  childParam: string;
}) {
  const today = isToday(date);
  const totalLessons = subjects.reduce((s, sub) => s + sub.totalLessons, 0);
  const completedLessons = subjects.reduce((s, sub) => s + sub.completedLessons, 0);
  const qs = childParam ? `?child=${childParam}` : "";

  return (
    <div
      className={`flex min-w-[180px] flex-1 flex-col rounded-xl border ${
        today ? "border-primary-300 bg-primary-50/30" : "border-gray-200 bg-gray-50/50"
      }`}
    >
      <Link
        href={`/week/${weekStart}/${date}${qs}`}
        className="flex items-baseline justify-between border-b px-3 py-2.5 hover:bg-gray-100/50"
      >
        <div>
          <span className={`text-sm font-semibold ${today ? "text-primary-700" : "text-gray-900"}`}>
            {formatWeekdayShort(date)}
          </span>
          <span className="ml-1.5 text-xs text-gray-500">{formatShortDate(date)}</span>
        </div>
        {totalLessons > 0 && (
          <span className="text-xs text-gray-400">
            {completedLessons}/{totalLessons}
          </span>
        )}
      </Link>
      <div className="flex flex-1 flex-col gap-2 p-2">
        {subjects.length === 0 ? (
          <p className="py-4 text-center text-xs text-gray-400">No lessons</p>
        ) : (
          subjects.map((sub) => (
            <SubjectCard
              key={sub.subjectId}
              subjectId={sub.subjectId}
              subjectName={sub.subjectName}
              subjectColor={sub.subjectColor}
              totalLessons={sub.totalLessons}
              completedLessons={sub.completedLessons}
              weekStart={weekStart}
              date={date}
              childParam={childParam}
            />
          ))
        )}
      </div>
    </div>
  );
}
