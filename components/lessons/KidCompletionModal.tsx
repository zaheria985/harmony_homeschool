"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { markLessonComplete } from "@/lib/actions/completions";
export default function KidCompletionModal({
  lessonId,
  childId,
}: {
  lessonId: string;
  childId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  function submitCompletion() {
    setError("");
    startTransition(async () => {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("childId", childId);
      formData.set("notes", notes.trim());
      const result = await markLessonComplete(formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setNotes("");
      router.refresh();
    });
  }
  return (
    <>
      {" "}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg bg-success-600 px-4 py-2 text-sm font-medium text-white hover:bg-success-700"
      >
        {" "}
        Mark complete{" "}
      </button>{" "}
      <Modal
        open={open}
        onClose={() => !isPending && setOpen(false)}
        title="Nice work!"
      >
        {" "}
        <div className="space-y-4">
          {" "}
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {" "}
            You finished this lesson. Add a quick note if you want, then tap
            complete.{" "}
          </p>{" "}
          <div>
            {" "}
            <label
              htmlFor="kid-completion-notes"
              className="mb-1 block text-sm font-medium text-secondary"
            >
              {" "}
              What did you learn? (optional){" "}
            </label>{" "}
            <textarea
              id="kid-completion-notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              maxLength={400}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              placeholder="I learned how to..."
            />{" "}
          </div>{" "}
          {error && <p className="text-sm text-red-600">{error}</p>}{" "}
          <div className="flex justify-end gap-2 border-t pt-3">
            {" "}
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={isPending}
              className="rounded-lg border px-4 py-2 text-sm text-secondary hover:bg-surface-muted disabled:opacity-50"
            >
              {" "}
              Cancel{" "}
            </button>{" "}
            <button
              type="button"
              onClick={submitCompletion}
              disabled={isPending}
              className="rounded-lg bg-success-600 px-4 py-2 text-sm font-medium text-white hover:bg-success-700 disabled:opacity-50"
            >
              {" "}
              {isPending ? "Saving..." : "Complete lesson"}{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </Modal>{" "}
    </>
  );
}
