"use client";

import { useState } from "react";
import Link from "next/link";
import DayModal from "./DayModal";
import { formatWeekdayShort, formatShortDate, isToday } from "@/lib/utils/dates";

interface GridLesson {
  id: string;
  title: string;
  status: string;
  curriculum_name: string;
  grade: number | null;
}

interface GridSubject {
  subjectName: string;
  subjectColor: string | null;
  lessons: GridLesson[];
}

interface DayData {
  date: string;
  subjects: GridSubject[];
}

export default function WeekGrid({ days }: { days: DayData[] }) {
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);

  return (
    <>
      <div className="grid grid-cols-7 gap-2">
        {days.map((day) => {
          const today = isToday(day.date);
          const totalLessons = day.subjects.reduce((s, sub) => s + sub.lessons.length, 0);
          const completedLessons = day.subjects.reduce(
            (s, sub) => s + sub.lessons.filter((l) => l.status === "completed").length,
            0
          );
          const isWeekend = day.subjects.length === 0 && [5, 6].includes(
            new Date(day.date + "T00:00:00").getDay()
          );

          return (
            <div
              key={day.date}
              onClick={() => totalLessons > 0 && setSelectedDay(day)}
              className={`flex min-h-[160px] flex-col rounded-xl border transition-colors ${
                today
                  ? "border-primary-300 bg-primary-50/30"
                  : isWeekend && totalLessons === 0
                  ? "border-gray-100 bg-gray-50/30"
                  : "border-gray-200 bg-white"
              } ${totalLessons > 0 ? "cursor-pointer hover:border-primary-300 hover:shadow-sm" : ""}`}
            >
              {/* Day header */}
              <div className="flex items-baseline justify-between border-b px-3 py-2">
                <div>
                  <span
                    className={`text-sm font-semibold ${
                      today ? "text-primary-700" : "text-gray-900"
                    }`}
                  >
                    {formatWeekdayShort(day.date)}
                  </span>
                  <span className="ml-1.5 text-xs text-gray-500">
                    {formatShortDate(day.date)}
                  </span>
                </div>
                {totalLessons > 0 && (
                  <span className="text-xs text-gray-400">
                    {completedLessons}/{totalLessons}
                  </span>
                )}
              </div>

              {/* Subject list with lesson titles */}
              <div className="flex-1 space-y-2 p-2">
                {totalLessons === 0 ? (
                  <p className="py-4 text-center text-xs text-gray-300">
                    {isWeekend ? "Weekend" : "No lessons"}
                  </p>
                ) : (
                  day.subjects.map((subject) => (
                    <div key={subject.subjectName}>
                      <div className="flex items-center gap-1.5 px-1">
                        <span
                          className="h-2 w-2 flex-shrink-0 rounded-full"
                          style={{ backgroundColor: subject.subjectColor || "#6366f1" }}
                        />
                        <span className="text-xs font-semibold text-gray-700">
                          {subject.subjectName}
                        </span>
                      </div>
                      <div className="mt-0.5 space-y-0.5 pl-4">
                        {subject.lessons.map((lesson) => (
                          <Link
                            key={lesson.id}
                            href={`/lessons/${lesson.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className={`block truncate text-xs transition-colors hover:text-primary-600 ${
                              lesson.status === "completed"
                                ? "text-gray-400 line-through"
                                : "text-gray-600"
                            }`}
                          >
                            {lesson.title}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DayModal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={
          selectedDay
            ? `${formatWeekdayShort(selectedDay.date)}, ${formatShortDate(selectedDay.date)}`
            : ""
        }
        subjects={selectedDay?.subjects || []}
      />
    </>
  );
}
