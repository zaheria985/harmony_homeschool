"use client";

import { useTransition } from "react";
import { markLessonComplete } from "@/lib/actions/completions";

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

  if (isCompleted) {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded border border-success-300 bg-success-100 text-success-700">
        &#10003;
      </span>
    );
  }

  function handleClick() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("childId", childId);
      await markLessonComplete(formData);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
        isPending
          ? "border-gray-300 bg-gray-100"
          : "border-gray-300 hover:border-primary-400 hover:bg-primary-50"
      }`}
      title="Mark complete"
    >
      {isPending && (
        <span className="h-3 w-3 animate-spin rounded-full border-2 border-gray-300 border-t-primary-500" />
      )}
    </button>
  );
}
