"use client";
import { useState, useTransition } from "react";
import {
  markLessonComplete,
  markLessonIncomplete,
} from "@/lib/actions/completions";
import { useRouter } from "next/navigation";
export default function LessonCompleteCheckbox({
  lessonId,
  childId,
  completed,
  pending,
}: {
  lessonId: string;
  childId: string;
  completed?: boolean;
  pending?: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // A kid's tick queues for approval instead of completing the lesson, so the
  // checkbox would otherwise snap back on refresh with no explanation.
  const [awaitingApproval, setAwaitingApproval] = useState(!!pending);
  const [error, setError] = useState("");

  function toggle(nextChecked: boolean) {
    setError("");
    startTransition(async () => {
      if (nextChecked) {
        const formData = new FormData();
        formData.set("lessonId", lessonId);
        formData.set("childId", childId);
        const result = await markLessonComplete(formData);
        if (result && "error" in result && result.error) {
          setError(result.error);
          return;
        }
        setAwaitingApproval(!!(result && "pending" in result && result.pending));
      } else {
        const result = await markLessonIncomplete(lessonId, childId);
        if (result && "error" in result && result.error) {
          setError(result.error);
          return;
        }
        setAwaitingApproval(false);
      }
      router.refresh();
    });
  }

  const label = error
    ? error
    : awaitingApproval
      ? "Sent to a parent for approval"
      : "Mark lesson complete";

  return (
    <span className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={!!completed || awaitingApproval}
        disabled={isPending || awaitingApproval}
        onChange={(e) => toggle(e.target.checked)}
        className="h-4 w-4 rounded border-border text-interactive focus:ring-focus disabled:opacity-60"
        aria-label={label}
        title={label}
      />
      {awaitingApproval && !error && (
        <span className="text-[10px] font-medium text-tertiary">Awaiting approval</span>
      )}
      {error && (
        <span role="alert" className="text-[10px] font-medium text-red-600">
          {error}
        </span>
      )}
    </span>
  );
}
