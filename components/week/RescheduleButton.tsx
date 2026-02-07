"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import { rescheduleLesson } from "@/lib/actions/lessons";

export default function RescheduleButton({
  lessonId,
  currentDate,
}: {
  lessonId: string;
  currentDate: string;
}) {
  const [open, setOpen] = useState(false);
  const [newDate, setNewDate] = useState(currentDate);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      await rescheduleLesson(lessonId, newDate);
      setOpen(false);
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-primary-600"
        title="Reschedule"
      >
        Reschedule
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Reschedule Lesson">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="newDate" className="block text-sm font-medium text-gray-700">
              New Date
            </label>
            <input
              id="newDate"
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || newDate === currentDate}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? "Moving..." : "Move"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
