"use client";
import { markLessonComplete } from "@/lib/actions/completions";
import { useRouter } from "next/navigation";
import { useState } from "react";
export default function CompletionForm({
  lessonId,
  childId,
  gradeType,
}: {
  lessonId: string;
  childId: string;
  gradeType: "numeric" | "pass_fail";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function handleSubmit(formData: FormData) {
    setPending(true);
    const result = await markLessonComplete(formData);
    if (result?.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
    setPending(false);
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit(new FormData(event.currentTarget));
      }}
      className="space-y-4"
    >
      {" "}
      <input type="hidden" name="lessonId" value={lessonId} />{" "}
      <input type="hidden" name="childId" value={childId} />{" "}
      <input type="hidden" name="gradeType" value={gradeType} />{" "}
      {gradeType === "numeric" ? (
        <div>
          {" "}
          <label className="block text-sm font-medium text-secondary">
            Grade (0-100)
          </label>{" "}
          <input
            type="number"
            name="grade"
            min={0}
            max={100}
            step="0.01"
            inputMode="decimal"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
            placeholder="Optional"
          />{" "}
        </div>
      ) : (
        <div>
          {" "}
          <label className="block text-sm font-medium text-secondary">
            Result
          </label>{" "}
          <div className="mt-1 flex gap-4 rounded-lg border border-border bg-surface px-3 py-2">
            {" "}
            <label className="flex items-center gap-2 text-sm text-secondary">
              {" "}
              <input type="radio" name="passFail" value="pass" /> Pass{" "}
            </label>{" "}
            <label className="flex items-center gap-2 text-sm text-secondary">
              {" "}
              <input type="radio" name="passFail" value="fail" /> Fail{" "}
            </label>{" "}
          </div>{" "}
          <p className="mt-1 text-xs text-muted">
            Defaults to Pass when left unselected.
          </p>{" "}
        </div>
      )}{" "}
      <div>
        {" "}
        <label className="block text-sm font-medium text-secondary">
          Notes
        </label>{" "}
        <textarea
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          placeholder="Optional notes..."
        />{" "}
      </div>{" "}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-success-600 px-4 py-2 text-sm font-medium text-white hover:bg-success-700 disabled:opacity-50"
      >
        {" "}
        {pending ? "Marking complete..." : "Mark as Complete"}{" "}
      </button>{" "}
    </form>
  );
}
