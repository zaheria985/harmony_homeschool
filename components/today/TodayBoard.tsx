"use client";
import { useEffect, useState } from "react";
import LessonCheckRow from "@/components/today/LessonCheckRow";
import EmptyState from "@/components/ui/EmptyState";
import type { KidColor } from "@/lib/utils/kid-colors";
import type { TodayChild, TodayLesson } from "@/lib/queries/today";

type SubjectGroup = {
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  lessons: TodayLesson[];
};

const VIEW_KEY = "today-view";

/**
 * Today's work, either a column per child or one list grouped by subject.
 * The choice sticks in localStorage because families settle into one rhythm.
 */
export default function TodayBoard({
  children,
  subjects,
  colors,
}: {
  children: TodayChild[];
  subjects: SubjectGroup[];
  colors: Record<string, KidColor>;
}) {
  const [view, setView] = useState<"kid" | "subject">("kid");

  useEffect(() => {
    const stored = localStorage.getItem(VIEW_KEY);
    if (stored === "subject" || stored === "kid") setView(stored);
  }, []);

  function choose(next: "kid" | "subject") {
    setView(next);
    localStorage.setItem(VIEW_KEY, next);
  }

  const nothingToday = children.every((child) => child.total === 0);

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <div
          role="group"
          aria-label="Group today's lessons"
          className="inline-flex overflow-hidden rounded-xl border border-border text-sm"
        >
          {(["kid", "subject"] as const).map((option) => (
            <button
              key={option}
              onClick={() => choose(option)}
              aria-pressed={view === option}
              className={`px-3 py-1.5 transition-colors ${
                view === option
                  ? "bg-[var(--interactive)] text-[var(--brand-contrast)]"
                  : "bg-surface text-tertiary hover:bg-surface-muted"
              }`}
            >
              {option === "kid" ? "By kid" : "By subject"}
            </button>
          ))}
        </div>
      </div>

      {nothingToday ? (
        <div className="rounded-card border border-light bg-surface shadow-warm">
          <EmptyState
            message="Nothing scheduled today"
            hint="Enjoy the quiet — or open the planner to pull work forward."
            ornament="seedling"
          />
        </div>
      ) : view === "kid" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {children.map((child) => {
            const color = colors[child.id];
            return (
              <section
                key={child.id}
                className="rounded-card border border-light bg-surface p-4 shadow-warm"
                style={{ borderTop: `3px solid ${color?.solid ?? "var(--interactive)"}` }}
              >
                <header className="mb-2 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: color?.bg,
                      color: color?.text,
                    }}
                  >
                    {child.name.charAt(0).toUpperCase()}
                  </span>
                  <h2 className="font-display text-lg text-primary">
                    {child.name}
                  </h2>
                  <span className="ml-auto text-xs text-muted">
                    {child.done} of {child.total}
                  </span>
                </header>
                {child.total === 0 ? (
                  <p className="py-3 text-sm text-muted">No lessons today.</p>
                ) : (
                  <ul>
                    {child.lessons.map((lesson) => (
                      <LessonCheckRow
                        key={`${lesson.id}:${lesson.child_id}`}
                        lessonId={lesson.id}
                        childId={lesson.child_id}
                        title={lesson.title}
                        subtitle={lesson.curriculum_name}
                        subjectColor={lesson.subject_color}
                        completed={lesson.completed}
                        pending={lesson.pending}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {subjects.map((group) => (
            <section
              key={group.subject_id}
              className="rounded-card border border-light bg-surface p-4 shadow-warm"
            >
              <header className="mb-2 flex items-center gap-2">
                {group.subject_color && (
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: group.subject_color }}
                  />
                )}
                <h2 className="font-display text-lg text-primary">
                  {group.subject_name}
                </h2>
              </header>
              <ul>
                {group.lessons.map((lesson) => (
                  <LessonCheckRow
                    key={`${lesson.id}:${lesson.child_id}`}
                    lessonId={lesson.id}
                    childId={lesson.child_id}
                    title={lesson.title}
                    subtitle={`${lesson.child_name} · ${lesson.curriculum_name}`}
                    subjectColor={colors[lesson.child_id]?.solid}
                    completed={lesson.completed}
                    pending={lesson.pending}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
