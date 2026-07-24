"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Hourglass, BookOpen, CalendarDays, Flame } from "lucide-react";
import ProgressRing from "@/components/ui/ProgressRing";
import BotanicalOrnament from "@/components/ui/BotanicalOrnament";
import { markLessonComplete } from "@/lib/actions/completions";
import type { KidColor } from "@/lib/utils/kid-colors";
import type { TodayLesson } from "@/lib/queries/today";

/**
 * A kid's whole school day: what is left, what is waiting to be checked, and
 * two doors out. Cards are deliberately large — this is used on a tablet with
 * a seven-year-old's finger.
 */
export default function KidDayBoard({
  lessons,
  color,
  streak,
}: {
  lessons: TodayLesson[];
  color: KidColor;
  streak: number;
}) {
  const done = lessons.filter((lesson) => lesson.completed).length;
  const remaining = lessons.filter(
    (lesson) => !lesson.completed && !lesson.pending,
  ).length;

  return (
    <div className="mx-auto max-w-xl">
      {lessons.length > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-card border border-light bg-surface p-3 shadow-warm">
          <ProgressRing
            value={done}
            total={lessons.length}
            size={52}
            color={color.solid}
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-primary">
              {remaining === 0
                ? "Everything is checked off"
                : `${remaining} to go — you've got this`}
            </p>
            {streak > 0 && (
              <p className="flex items-center gap-1 text-xs text-tertiary">
                <Flame size={13} className="text-[var(--accent-solid)]" />
                {streak}-day school streak
              </p>
            )}
          </div>
        </div>
      )}

      {lessons.length === 0 ? (
        <div className="rounded-card border border-light bg-surface p-8 text-center shadow-warm">
          <div className="flex justify-center text-interactive-border">
            <BotanicalOrnament variant="seedling" size={56} />
          </div>
          <p className="mt-3 font-display text-xl text-primary">
            No lessons today
          </p>
          <p className="mt-1 text-sm text-tertiary">Go play outside.</p>
        </div>
      ) : remaining === 0 ? (
        <>
          <div className="mb-4 rounded-card border border-[var(--success-border)] bg-[var(--success-bg)] p-6 text-center">
            <div className="flex justify-center text-[var(--success-text)]">
              <BotanicalOrnament variant="sprig" size={52} />
            </div>
            <p className="mt-2 font-display text-xl text-[var(--success-text)]">
              That&apos;s school for today!
            </p>
          </div>
          <LessonList lessons={lessons} color={color} />
        </>
      ) : (
        <LessonList lessons={lessons} color={color} />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <Link
          href="/reading"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-card border border-light bg-surface text-sm font-medium text-primary shadow-warm"
        >
          <BookOpen size={18} className="text-[var(--interactive)]" />
          Log reading
        </Link>
        <Link
          href="/week"
          className="flex min-h-[52px] items-center justify-center gap-2 rounded-card border border-light bg-surface text-sm font-medium text-primary shadow-warm"
        >
          <CalendarDays size={18} className="text-[var(--accent-solid)]" />
          My week
        </Link>
      </div>
    </div>
  );
}

function LessonList({
  lessons,
  color,
}: {
  lessons: TodayLesson[];
  color: KidColor;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {lessons.map((lesson) => (
        <KidLessonCard
          key={`${lesson.id}:${lesson.child_id}`}
          lesson={lesson}
          color={color}
        />
      ))}
    </ul>
  );
}

function KidLessonCard({
  lesson,
  color,
}: {
  lesson: TodayLesson;
  color: KidColor;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [awaiting, setAwaiting] = useState(lesson.pending);
  const [error, setError] = useState("");
  const done = lesson.completed;

  function submit() {
    if (done || awaiting || isPending) return;
    setError("");
    setAwaiting(true);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("lessonId", lesson.id);
      formData.set("childId", lesson.child_id);
      const result = await markLessonComplete(formData);
      if (result && "error" in result && result.error) {
        setAwaiting(false);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const state = done ? "done" : awaiting ? "awaiting" : "open";
  const styles = {
    done: {
      className: "border-[var(--success-border)] bg-[var(--success-bg)]",
      title: "text-[var(--success-text)] line-through",
      meta: "text-[var(--success-text)]",
    },
    awaiting: {
      className: "border-[var(--warning-border)] bg-[var(--warning-bg)]",
      title: "text-[var(--warning-text)]",
      meta: "text-[var(--warning-text)]",
    },
    open: {
      className: "border-light bg-surface",
      title: "font-medium text-primary",
      meta: "text-tertiary",
    },
  }[state];

  return (
    <li>
      <button
        type="button"
        onClick={submit}
        disabled={done || awaiting || isPending}
        aria-label={
          state === "done"
            ? `${lesson.title} is done`
            : state === "awaiting"
              ? `${lesson.title} is waiting to be checked`
              : `Mark ${lesson.title} done`
        }
        className={`flex min-h-[64px] w-full items-center gap-3 rounded-card border p-3 text-left shadow-warm transition-colors ${styles.className}`}
      >
        <span className="shrink-0">
          {state === "done" ? (
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--success-solid)]">
              <Check size={16} className="text-white" />
            </span>
          ) : state === "awaiting" ? (
            <Hourglass size={26} className="text-[var(--warning-solid)]" />
          ) : (
            <Circle size={26} className="text-slate" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm ${styles.title}`}>{lesson.title}</span>
          <span className={`block text-xs ${styles.meta}`}>
            {state === "awaiting"
              ? "Waiting to be checked"
              : state === "done"
                ? `${lesson.subject_name} · done!`
                : lesson.subject_name}
          </span>
        </span>
        {state === "open" && (
          <span
            aria-hidden="true"
            className="h-8 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: color.solid }}
          />
        )}
      </button>
      {error && (
        <p role="alert" className="mt-1 text-xs font-medium text-[var(--error-text)]">
          {error}
        </p>
      )}
    </li>
  );
}
