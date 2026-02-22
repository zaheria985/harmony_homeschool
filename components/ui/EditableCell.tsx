"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type EditableCellProps = {
  value: string;
  onSave: (value: string) => Promise<{ success?: boolean; error?: string }>;
  type?: "text" | "select" | "color";
  options?: { value: string; label: string }[];
  displayValue?: React.ReactNode;
  className?: string;
};

export default function EditableCell({
  value,
  onSave,
  type = "text",
  options,
  displayValue,
  className = "",
}: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if (type === "text" && inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [editing, type]);

  // Reset editValue when value prop changes (after save + revalidation)
  useEffect(() => {
    if (!editing) setEditValue(value);
  }, [value, editing]);

  const save = useCallback(async () => {
    if (editValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError("");
    const result = await onSave(editValue);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setEditing(false);
    }
  }, [editValue, value, onSave]);

  const cancel = useCallback(() => {
    setEditValue(value);
    setEditing(false);
    setError("");
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        save();
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    },
    [save, cancel],
  );

  const startEditing = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(true);
  }, []);

  if (editing) {
    return (
      <div
        className={`relative ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {type === "select" && options ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={editValue}
            onChange={(e) => {
              setEditValue(e.target.value);
              // Auto-save on select change
              const newVal = e.target.value;
              if (newVal !== value) {
                setSaving(true);
                setError("");
                onSave(newVal).then((result) => {
                  setSaving(false);
                  if (result.error) {
                    setError(result.error);
                  } else {
                    setEditing(false);
                  }
                });
              } else {
                setEditing(false);
              }
            }}
            onBlur={cancel}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="w-full rounded border border-interactive-border bg-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
          >
            {options.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        ) : type === "color" ? (
          <div className="flex items-center gap-2">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="color"
              value={editValue || "#6366f1"}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={save}
              onKeyDown={handleKeyDown}
              disabled={saving}
              className="h-7 w-10 cursor-pointer rounded border border-border disabled:opacity-50"
            />
          </div>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={save}
            onKeyDown={handleKeyDown}
            disabled={saving}
            className="w-full rounded border border-interactive-border bg-surface px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-focus disabled:opacity-50"
          />
        )}
        {saving && (
          <span className="absolute -top-5 left-0 text-xs text-interactive">
            Saving...
          </span>
        )}
        {error && (
          <span className="absolute -bottom-5 left-0 text-xs text-red-500">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startEditing}
      className={`group cursor-pointer rounded px-1 py-0.5 -mx-1 -my-0.5 text-left hover:bg-interactive-light hover:ring-1 hover:ring-primary-200 focus-visible:ring-2 focus-visible:ring-focus focus-visible:outline-none transition-colors ${className}`}
      aria-label="Click to edit"
    >
      {displayValue ??
        (editValue || <span className="text-muted italic">—</span>)}
    </button>
  );
}
