"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markLessonIncomplete } from "@/lib/actions/completions";

export default function UncompleteButton({
  lessonId,
  childId,
}: {
  lessonId: string;
  childId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (
      !confirm(
        "Mark this lesson as incomplete? The grade and notes will be removed.",
      )
    )
      return;

    startTransition(async () => {
      await markLessonIncomplete(lessonId, childId);
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="rounded-md px-2 py-1 text-xs font-medium text-error-600 transition-colors hover:bg-error-50 disabled:opacity-50"
    >
      {isPending ? "Removing..." : "Mark Incomplete"}
    </button>
  );
}
