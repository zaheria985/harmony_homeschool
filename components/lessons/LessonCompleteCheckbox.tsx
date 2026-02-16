"use client";
import { useTransition } from "react";
import {
  markLessonComplete,
  markLessonIncomplete,
} from "@/lib/actions/completions";
import { useRouter } from "next/navigation";
export default function LessonCompleteCheckbox({
  lessonId,
  childId,
  completed,
}: {
  lessonId: string;
  childId: string;
  completed?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  function toggle(nextChecked: boolean) {
    startTransition(async () => {
      if (nextChecked) {
        const formData = new FormData();
        formData.set("lessonId", lessonId);
        formData.set("childId", childId);
        await markLessonComplete(formData);
      } else {
        await markLessonIncomplete(lessonId, childId);
      }
      router.refresh();
    });
  }
  return (
    <input
      type="checkbox"
      checked={!!completed}
      disabled={isPending}
      onChange={(e) => toggle(e.target.checked)}
      className="h-4 w-4 rounded border-border text-interactive focus:ring-focus"
      aria-label="Mark lesson complete"
    />
  );
}
