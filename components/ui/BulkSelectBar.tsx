"use client";

import { Trash2 } from "lucide-react";

type BulkSelectBarProps = {
  selectedCount: number;
  totalCount: number;
  onToggleSelectAll: () => void;
  onBulkDelete: () => void;
  deleteWarning?: string;
  isDeleting?: boolean;
};

export default function BulkSelectBar({
  selectedCount,
  totalCount,
  onToggleSelectAll,
  onBulkDelete,
  deleteWarning,
  isDeleting = false,
}: BulkSelectBarProps) {
  function handleDelete() {
    const msg =
      deleteWarning ||
      `Delete ${selectedCount} selected item${selectedCount === 1 ? "" : "s"}? This cannot be undone.`;
    if (!confirm(msg)) return;
    onBulkDelete();
  }

  return (
    <div className="mb-4 flex items-center gap-3">
      <button
        type="button"
        onClick={onToggleSelectAll}
        className="rounded-lg border border-light px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface-muted"
      >
        {selectedCount === totalCount && totalCount > 0
          ? "Deselect all"
          : "Select all"}
      </button>
      {selectedCount > 0 && (
        <>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={13} />
            {isDeleting
              ? "Deleting..."
              : `Delete selected (${selectedCount})`}
          </button>
          <span className="text-xs text-muted">
            {selectedCount} of {totalCount} selected
          </span>
        </>
      )}
    </div>
  );
}
