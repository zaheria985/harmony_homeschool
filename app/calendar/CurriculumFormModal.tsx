"use client";
import { useState } from "react";
import Modal from "@/components/ui/Modal";
import { createCurriculum } from "@/lib/actions/lessons";
export default function CurriculumFormModal({
  open,
  onClose,
  subjectId,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  subjectId: string;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [courseType, setCourseType] = useState<"curriculum" | "unit_study">(
    "curriculum",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("subject_id", subjectId);
    fd.set("description", description);
    fd.set("course_type", courseType);
    const result = await createCurriculum(fd);
    setSaving(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("id" in result) {
      setName("");
      setDescription("");
      setCourseType("curriculum");
      onCreated(result.id as string);
    }
  }
  return (
    <Modal open={open} onClose={onClose} title="New Course">
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
            {" "}
            Description{" "}
          </label>{" "}
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
          />{" "}
        </div>{" "}
        <div>
          {" "}
          <label className="mb-1 block text-sm font-medium text-secondary">
            {" "}
            Course Type{" "}
          </label>{" "}
          <select
            value={courseType}
            onChange={(e) =>
              setCourseType(e.target.value as "curriculum" | "unit_study")
            }
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
          >
            {" "}
            <option value="curriculum">Course</option>{" "}
            <option value="unit_study">Unit Study</option>{" "}
          </select>{" "}
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
            {saving ? "Creating..." : "Create Course"}{" "}
          </button>{" "}
        </div>{" "}
      </form>{" "}
    </Modal>
  );
}
