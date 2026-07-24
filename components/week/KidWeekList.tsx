import Link from "next/link";
import { Check, Circle, ChevronLeft, ChevronRight } from "lucide-react";
import { formatWeekdayShort, formatShortDate, isToday } from "@/lib/utils/dates";
import type { KidColor } from "@/lib/utils/kid-colors";

export type KidWeekDay = {
  date: string;
  lessons: {
    id: string;
    title: string;
    subject_name: string;
    subject_color: string | null;
    completed: boolean;
  }[];
};

/**
 * A kid's week, read-only. Checking work off happens on My Day, where one
 * day's worth of cards is big enough to tap confidently; this view exists to
 * answer "what's coming up".
 */
export default function KidWeekList({
  days,
  label,
  color,
  previousWeek,
  nextWeek,
}: {
  days: KidWeekDay[];
  label: string;
  color: KidColor;
  previousWeek: string;
  nextWeek: string;
}) {
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href={previousWeek}
          aria-label="Previous week"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-light bg-surface text-tertiary"
        >
          <ChevronLeft size={20} />
        </Link>
        <p className="font-display text-lg text-primary">{label}</p>
        <Link
          href={nextWeek}
          aria-label="Next week"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-light bg-surface text-tertiary"
        >
          <ChevronRight size={20} />
        </Link>
      </div>

      <ul className="flex flex-col gap-2">
        {days.map((day) => {
          const today = isToday(day.date);
          const done = day.lessons.filter((lesson) => lesson.completed).length;
          return (
            <li
              key={day.date}
              className="rounded-card border bg-surface p-3 shadow-warm"
              style={{
                borderColor: today ? color.solid : "var(--border-light)",
              }}
            >
              <div className="mb-1 flex items-baseline gap-2">
                <span className="text-sm font-medium text-primary">
                  {formatWeekdayShort(day.date)}
                </span>
                <span className="text-xs text-muted">
                  {formatShortDate(day.date)}
                </span>
                {today && (
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                    style={{ backgroundColor: color.bg, color: color.text }}
                  >
                    today
                  </span>
                )}
                {day.lessons.length > 0 && (
                  <span className="ml-auto text-xs text-muted">
                    {done}/{day.lessons.length}
                  </span>
                )}
              </div>
              {day.lessons.length === 0 ? (
                <p className="text-xs text-muted">Nothing scheduled.</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {day.lessons.map((lesson) => (
                    <li
                      key={lesson.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      {lesson.completed ? (
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--interactive)]">
                          <Check size={10} className="text-[var(--brand-contrast)]" />
                        </span>
                      ) : (
                        <Circle size={16} className="shrink-0 text-slate" />
                      )}
                      {lesson.subject_color && (
                        <span
                          aria-hidden="true"
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: lesson.subject_color }}
                        />
                      )}
                      <span
                        className={
                          lesson.completed
                            ? "text-muted line-through"
                            : "text-secondary"
                        }
                      >
                        {lesson.title}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
