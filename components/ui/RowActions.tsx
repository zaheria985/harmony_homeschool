"use client";

import { Eye, Pencil, Trash2 } from "lucide-react";

type RowActionsProps = {
  onView?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteWarning?: string;
  disabled?: boolean;
};

export default function RowActions({
  onView,
  onEdit,
  onDelete,
  deleteWarning,
  disabled = false,
}: RowActionsProps) {
  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (!onDelete) return;
    const msg = deleteWarning || "Delete this item? This cannot be undone.";
    if (!confirm(msg)) return;
    onDelete();
  }

  return (
    <div className="flex items-center gap-1">
      {onView && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          disabled={disabled}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-primary transition-colors"
          aria-label="View"
          title="View"
        >
          <Eye size={15} />
        </button>
      )}
      {onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          disabled={disabled}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-primary transition-colors"
          aria-label="Edit"
          title="Edit"
        >
          <Pencil size={15} />
        </button>
      )}
      {onDelete && (
        <button
          onClick={handleDelete}
          disabled={disabled}
          className="rounded-lg p-1.5 text-muted hover:bg-[var(--error-bg)] hover:text-red-600 dark:hover:text-red-400 transition-colors"
          aria-label="Delete"
          title="Delete"
        >
          <Trash2 size={15} />
        </button>
      )}
    </div>
  );
}
