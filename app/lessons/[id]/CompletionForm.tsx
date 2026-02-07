"use client";

import { markLessonComplete } from "@/lib/actions/completions";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function CompletionForm({
  lessonId,
  childId,
}: {
  lessonId: string;
  childId: string;
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
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="lessonId" value={lessonId} />
      <input type="hidden" name="childId" value={childId} />

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Grade (0-100)
        </label>
        <input
          type="number"
          name="grade"
          min={0}
          max={100}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Optional"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">Notes</label>
        <textarea
          name="notes"
          rows={3}
          className="mt-1 w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          placeholder="Optional notes..."
        />
      </div>

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-success-600 px-4 py-2 text-sm font-medium text-white hover:bg-success-700 disabled:opacity-50"
      >
        {pending ? "Marking complete..." : "Mark as Complete"}
      </button>
    </form>
  );
}
