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

    const result = await createCurriculum(fd);
    setSaving(false);

    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }

    if (result.success && "id" in result) {
      setName("");
      setDescription("");
      onCreated(result.id as string);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New Curriculum">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
        )}

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Curriculum"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
