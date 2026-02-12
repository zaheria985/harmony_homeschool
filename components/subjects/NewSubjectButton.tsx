"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { createSubject } from "@/lib/actions/lessons";
const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary";
const PRESET_COLORS = [
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
export default function NewSubjectButton() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  function reset() {
    setName("");
    setColor(PRESET_COLORS[0]);
    setError("");
    setSubmitting(false);
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("color", color);
    const result = await createSubject(formData);
    if ("error" in result) {
      setError(result.error || "Failed to create subject");
      setSubmitting(false);
      return;
    }
    reset();
    setOpen(false);
  }
  return (
    <>
      {" "}
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
      >
        {" "}
        + New Subject{" "}
      </button>{" "}
      <Modal open={open} onClose={() => setOpen(false)} title="New Subject">
        {" "}
        <form onSubmit={handleSubmit} className="space-y-4">
          {" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Name
            </label>{" "}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={fieldClass}
              required
              placeholder="e.g. Mathematics"
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Color
            </label>{" "}
            <div className="flex flex-wrap gap-2">
              {" "}
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-full border-2 ${color === c ? "border-gray-900 dark:border-slate" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                />
              ))}{" "}
            </div>{" "}
          </div>{" "}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}{" "}
          <div className="flex justify-end gap-3 pt-2">
            {" "}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted dark:hover:bg-slate-800"
            >
              {" "}
              Cancel{" "}
            </button>{" "}
            <button
              type="submit"
              disabled={submitting || !name}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              {submitting ? "Creating..." : "Create Subject"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </Modal>{" "}
    </>
  );
}
