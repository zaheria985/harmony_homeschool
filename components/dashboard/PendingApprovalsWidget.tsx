"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approvePendingCompletion,
  rejectPendingCompletion,
} from "@/lib/actions/completions";

type PendingCompletion = {
  id: string;
  lesson_id: string;
  child_id: string;
  notes: string | null;
  grade: number | null;
  created_at: string;
  lesson_title: string;
  lesson_section: string | null;
  child_name: string;
  submitted_by_name: string | null;
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function PendingApprovalsWidget({
  pendingCompletions,
}: {
  pendingCompletions: PendingCompletion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);

  if (pendingCompletions.length === 0) return null;

  function handleApprove(id: string) {
    setProcessingId(id);
    startTransition(async () => {
      const result = await approvePendingCompletion(id);
      if (result.error) {
        alert(result.error);
      }
      setProcessingId(null);
      router.refresh();
    });
  }

  function handleReject(id: string) {
    if (!confirm("Reject this completion? It will be permanently deleted.")) {
      return;
    }
    setProcessingId(id);
    startTransition(async () => {
      const result = await rejectPendingCompletion(id);
      if (result.error) {
        alert(result.error);
      }
      setProcessingId(null);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl border border-light bg-surface p-4 shadow-warm">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold text-primary">
          Pending Approvals
        </h2>
        <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--warning-bg)] px-1.5 text-[11px] font-semibold text-[var(--warning-text)]">
          {pendingCompletions.length}
        </span>
      </div>

      <ul className="divide-y divide-[var(--border-light)]">
        {pendingCompletions.map((item) => {
          const isProcessing = processingId === item.id && isPending;
          return (
            <li key={item.id} className="py-3 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-primary">
                    <span className="text-interactive">{item.child_name}</span>
                    {" \u2014 "}
                    {item.lesson_title}
                  </p>
                  {item.lesson_section && (
                    <p className="mt-0.5 text-xs text-muted">
                      {item.lesson_section}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted">
                    {item.submitted_by_name && (
                      <span>Submitted by {item.submitted_by_name}</span>
                    )}
                    <span>{formatRelativeDate(item.created_at)}</span>
                    {item.grade != null && <span>Grade: {item.grade}</span>}
                  </div>
                  {item.notes && (
                    <p className="mt-1 text-xs italic text-secondary">
                      &ldquo;{item.notes}&rdquo;
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(item.id)}
                    disabled={isProcessing}
                    className="rounded bg-[var(--success-bg)] px-3 py-1 text-xs font-medium text-[var(--success-text)] hover:opacity-80 disabled:opacity-50"
                  >
                    {isProcessing && processingId === item.id
                      ? "..."
                      : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(item.id)}
                    disabled={isProcessing}
                    className="rounded border border-[var(--error-border)] px-3 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)] disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
