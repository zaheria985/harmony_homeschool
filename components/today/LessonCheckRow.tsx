"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle, Hourglass } from "lucide-react";
import {
  markLessonComplete,
  markLessonIncomplete,
} from "@/lib/actions/completions";

/**
 * One tappable lesson line on the Today view.
 *
 * A parent's tap completes the lesson outright; a kid's tap queues it for
 * approval, and the action tells us which happened via `pending`. The row
 * holds that answer locally so the tick does not snap back before the router
 * refresh lands.
 */
export default function LessonCheckRow({
  lessonId,
  childId,
  title,
  subtitle,
  subjectColor,
  completed,
  pending,
}: {
  lessonId: string;
  childId: string;
  title: string;
  subtitle?: string;
  subjectColor?: string | null;
  completed: boolean;
  pending: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [done, setDone] = useState(completed);
  const [awaiting, setAwaiting] = useState(pending);
  const [error, setError] = useState("");

  function toggle() {
    if (isPending || awaiting) return;
    setError("");
    const next = !done;
    setDone(next);

    startTransition(async () => {
      if (next) {
        const formData = new FormData();
        formData.set("lessonId", lessonId);
        formData.set("childId", childId);
        const result = await markLessonComplete(formData);
        if (result && "error" in result && result.error) {
          setDone(false);
          setError(result.error);
          return;
        }
        const queued = !!(result && "pending" in result && result.pending);
        setAwaiting(queued);
        if (queued) setDone(false);
      } else {
        const result = await markLessonIncomplete(lessonId, childId);
        if (result && "error" in result && result.error) {
          setDone(true);
          setError(result.error);
          return;
        }
        setAwaiting(false);
      }
      router.refresh();
    });
  }

  const state = awaiting ? "awaiting" : done ? "done" : "open";
  const label = error
    ? error
    : state === "awaiting"
      ? `${title} — waiting for a parent to check`
      : state === "done"
        ? `${title} — done, tap to undo`
        : `Mark ${title} complete`;

  return (
    <li className="border-b border-light last:border-b-0">
      <button
        type="button"
        onClick={toggle}
        disabled={isPending || awaiting}
        aria-label={label}
        aria-pressed={state !== "open"}
        className="flex min-h-[44px] w-full items-center gap-2.5 py-2 text-left transition-opacity disabled:opacity-70"
      >
        <span className="shrink-0">
          {state === "awaiting" ? (
            <Hourglass size={18} className="text-[var(--warning-solid)]" />
          ) : state === "done" ? (
            <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full bg-[var(--interactive)]">
              <Check size={12} className="text-[var(--brand-contrast)]" />
            </span>
          ) : (
            <Circle size={18} className="text-slate" />
          )}
        </span>
        {subjectColor && (
          <span
            aria-hidden="true"
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: subjectColor }}
          />
        )}
        <span className="min-w-0 flex-1">
          <span
            className={`block text-sm ${
              state === "done"
                ? "text-muted line-through"
                : state === "awaiting"
                  ? "text-[var(--warning-text)]"
                  : "text-primary"
            }`}
          >
            {title}
          </span>
          {(subtitle || state === "awaiting") && (
            <span className="block text-xs text-muted">
              {state === "awaiting" ? "Waiting to be checked" : subtitle}
            </span>
          )}
        </span>
      </button>
      {error && (
        <p role="alert" className="pb-2 text-xs font-medium text-[var(--error-text)]">
          {error}
        </p>
      )}
    </li>
  );
}
