"use client";

import { useTransition } from "react";
import { updateKidPermission } from "@/lib/actions/auth";

const labels: Record<string, string> = {
  full: "Full Access",
  mark_complete: "Mark Complete",
  view_only: "View Only",
};

export default function PermissionSelect({
  userId,
  currentLevel,
}: {
  userId: string;
  currentLevel: string;
}) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    startTransition(async () => {
      await updateKidPermission(userId, e.target.value);
    });
  }

  return (
    <select
      value={currentLevel}
      onChange={handleChange}
      disabled={isPending}
      className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-secondary focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
      title={`Permission: ${labels[currentLevel] || currentLevel}`}
    >
      <option value="full">Full Access</option>
      <option value="mark_complete">Mark Complete</option>
      <option value="view_only">View Only</option>
    </select>
  );
}
