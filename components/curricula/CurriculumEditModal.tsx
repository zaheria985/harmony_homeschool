"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { updateCurriculum } from "@/lib/actions/lessons";

type CurriculumForEdit = {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
} | null;

export default function CurriculumEditModal({
  curriculum,
  onClose,
}: {
  curriculum: CurriculumForEdit;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!curriculum) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await updateCurriculum(formData);

    setSaving(false);
    if (result && "error" in result) {
      alert(result.error);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <Modal open={!!curriculum} onClose={onClose} title="Edit Course">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="id" value={curriculum.id} />

        <div>
          <label htmlFor="curriculum-name" className="block text-sm font-medium text-secondary mb-1">
            Name
          </label>
          <input
            id="curriculum-name"
            name="name"
            type="text"
            required
            defaultValue={curriculum.name}
            className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        <div>
          <label htmlFor="curriculum-description" className="block text-sm font-medium text-secondary mb-1">
            Description
          </label>
          <textarea
            id="curriculum-description"
            name="description"
            rows={3}
            defaultValue={curriculum.description || ""}
            className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        <div>
          <label htmlFor="curriculum-cover" className="block text-sm font-medium text-secondary mb-1">
            Cover Image URL
          </label>
          <input
            id="curriculum-cover"
            name="cover_image"
            type="text"
            defaultValue={curriculum.cover_image || ""}
            placeholder="https://..."
            className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
