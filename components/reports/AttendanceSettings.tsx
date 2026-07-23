"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateInstructionalMinutes } from "@/lib/actions/attendance";

/**
 * Sets how many instructional minutes an attended day is worth by default.
 * Individual days can still be overridden on their own row.
 */
export default function AttendanceSettings({
  currentMinutes,
}: {
  currentMinutes: number;
}) {
  const router = useRouter();
  const [minutes, setMinutes] = useState(currentMinutes);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function save() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateInstructionalMinutes(minutes);
      if (result && "error" in result) {
        setMessage(result.error ?? "Failed to save");
      } else {
        setMessage("Saved");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="minutes-per-day" className="text-sm text-secondary">
        Minutes per school day
      </label>
      <input
        id="minutes-per-day"
        type="number"
        min={1}
        max={1440}
        value={minutes}
        onChange={(event) => setMinutes(Number(event.target.value))}
        className="w-24 rounded-lg border border-light bg-surface px-2 py-1.5 text-sm text-primary"
      />
      <button
        type="button"
        onClick={save}
        disabled={isPending || minutes === currentMinutes}
        className="rounded-lg border border-light px-3 py-1.5 text-sm text-secondary hover:border-interactive-border hover:text-interactive disabled:opacity-50"
      >
        {isPending ? "Saving…" : "Save"}
      </button>
      {message && <span className="text-xs text-muted">{message}</span>}
    </div>
  );
}
