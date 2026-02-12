"use client";
import { useTransition } from "react";
import {
  markLessonComplete,
  markLessonIncomplete,
} from "@/lib/actions/completions";
export default function LessonCheckbox({
  lessonId,
  childId,
  isCompleted,
}: {
  lessonId: string;
  childId: string;
  isCompleted: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  function handleClick() {
    startTransition(async () => {
      if (isCompleted) {
        await markLessonIncomplete(lessonId, childId);
      } else {
        const formData = new FormData();
        formData.set("lessonId", lessonId);
        formData.set("childId", childId);
        await markLessonComplete(formData);
      }
    });
  }
  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${isPending ? "border-border bg-surface-subtle" : "border-border hover:border-primary-400 hover:bg-interactive-light dark:hover:bg-primary-900/20"}`}
      title="Mark complete"
    >
      {" "}
      {isPending && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-border border-t-primary-500" />
      )}{" "}
      {!isPending && isCompleted && <span>&#10003;</span>}{" "}
      {!isPending && !isCompleted && null}{" "}
    </button>
  );
}
