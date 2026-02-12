"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { createSubject } from "@/lib/actions/lessons";
const COLORS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
];
export default function SubjectFormModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("color", color);
    const result = await createSubject(fd);
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("id" in result) {
      setName("");
      setColor(COLORS[0]);
      onCreated(result.id as string);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="New Subject">
      {" "}
      <form onSubmit={handleSubmit} className="space-y-4">
        {" "}
        {error && (
          <p className="rounded-lg bg-[var(--error-bg)] p-2 text-sm text-red-600/20 dark:text-red-300">
            {error}
          </p>
        )}{" "}
        <div>
          {" "}
          <label className="mb-1 block text-sm font-medium text-secondary">
            {" "}
            Name <span className="text-red-400">*</span>{" "}
          </label>{" "}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
          />{" "}
        </div>{" "}
        <div>
          {" "}
          <label className="mb-1 block text-sm font-medium text-secondary">
            Color
          </label>{" "}
          <div className="flex flex-wrap gap-2">
            {" "}
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-8 w-8 rounded-full border-2 ${color === c ? "border-gray-900 dark:border-slate" : "border-transparent"}`}
                style={{ backgroundColor: c }}
              />
            ))}{" "}
          </div>{" "}
        </div>{" "}
        <div className="flex justify-end gap-2 border-t border-light pt-4">
          {" "}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted dark:hover:bg-slate-800"
          >
            {" "}
            Cancel{" "}
          </button>{" "}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
          >
            {" "}
            {saving ? "Creating..." : "Create Subject"}{" "}
          </button>{" "}
        </div>{" "}
      </form>{" "}
    </Modal>
  );
}
