"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approvePendingCompletion,
  rejectPendingCompletion,
} from "@/lib/actions/completions";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { CheckCircle2, XCircle, CheckCheck } from "lucide-react";

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

function formatDate(dateStr: string): string {
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
    year: "numeric",
  });
}

export default function ApprovalsClient({
  pending,
}: {
  pending: PendingCompletion[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  if (pending.length === 0) {
    return (
      <EmptyState
        message="All caught up! No pending completions to review."
        icon={<CheckCircle2 size={28} className="text-muted" />}
      />
    );
  }

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

  function handleBulkApprove() {
    if (
      !confirm(
        `Approve all ${pending.length} pending completion${pending.length === 1 ? "" : "s"}?`
      )
    ) {
      return;
    }
    setBulkProcessing(true);
    startTransition(async () => {
      for (const item of pending) {
        const result = await approvePendingCompletion(item.id);
        if (result.error) {
          alert(`Failed to approve "${item.lesson_title}": ${result.error}`);
          break;
        }
      }
      setBulkProcessing(false);
      router.refresh();
    });
  }

  return (
    <div>
      {/* Summary bar */}
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-secondary">
          <span className="font-semibold text-primary">{pending.length}</span>{" "}
          pending completion{pending.length === 1 ? "" : "s"} to review
        </p>
        <button
          type="button"
          onClick={handleBulkApprove}
          disabled={isPending || bulkProcessing}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--success-bg)] px-4 py-2 text-sm font-medium text-[var(--success-text)] transition-colors hover:opacity-80 disabled:opacity-50"
        >
          <CheckCheck size={16} />
          {bulkProcessing ? "Approving..." : "Approve All"}
        </button>
      </div>

      {/* Cards list */}
      <div className="space-y-4">
        {pending.map((item) => {
          const isProcessing =
            (processingId === item.id && isPending) || bulkProcessing;
          return (
            <div
              key={item.id}
              className="rounded-2xl border border-light bg-surface p-5 shadow-warm transition-shadow hover:shadow-warm-md"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-primary">
                      {item.lesson_title}
                    </h3>
                    {item.lesson_section && (
                      <Badge variant="default">{item.lesson_section}</Badge>
                    )}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-secondary">
                    <span>
                      <span className="text-muted">Student:</span>{" "}
                      <span className="font-medium text-interactive">
                        {item.child_name}
                      </span>
                    </span>
                    {item.submitted_by_name && (
                      <span>
                        <span className="text-muted">Submitted by:</span>{" "}
                        {item.submitted_by_name}
                      </span>
                    )}
                    <span>
                      <span className="text-muted">When:</span>{" "}
                      {formatDate(item.created_at)}
                    </span>
                  </div>

                  {(item.grade != null || item.notes) && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {item.grade != null && (
                        <Badge variant="info">Grade: {item.grade}</Badge>
                      )}
                      {item.notes && (
                        <p className="text-sm italic text-secondary">
                          &ldquo;{item.notes}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleApprove(item.id)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--success-bg)] px-4 py-2 text-sm font-medium text-[var(--success-text)] transition-colors hover:opacity-80 disabled:opacity-50"
                  >
                    <CheckCircle2 size={16} />
                    {processingId === item.id && isPending
                      ? "Approving..."
                      : "Approve"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(item.id)}
                    disabled={isProcessing}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--error-border)] px-4 py-2 text-sm font-medium text-[var(--error-text)] transition-colors hover:bg-[var(--error-bg)] disabled:opacity-50"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
