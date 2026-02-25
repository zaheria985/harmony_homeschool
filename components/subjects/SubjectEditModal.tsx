"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { updateSubject } from "@/lib/actions/lessons";

type SubjectForEdit = {
  id: string;
  name: string;
  color: string | null;
  thumbnail_url: string | null;
} | null;

export default function SubjectEditModal({
  subject,
  onClose,
}: {
  subject: SubjectForEdit;
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  if (!subject) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await updateSubject(formData);

    setSaving(false);
    if (result && "error" in result) {
      alert(result.error);
      return;
    }

    router.refresh();
    onClose();
  }

  return (
    <Modal open={!!subject} onClose={onClose} title="Edit Subject">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="id" value={subject.id} />

        <div>
          <label htmlFor="subject-name" className="block text-sm font-medium text-secondary mb-1">
            Name
          </label>
          <input
            id="subject-name"
            name="name"
            type="text"
            required
            defaultValue={subject.name}
            className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        <div>
          <label htmlFor="subject-color" className="block text-sm font-medium text-secondary mb-1">
            Color
          </label>
          <input
            id="subject-color"
            name="color"
            type="color"
            defaultValue={subject.color || "#6366f1"}
            className="h-10 w-16 cursor-pointer rounded-lg border border-light bg-surface p-1"
          />
        </div>

        <div>
          <label htmlFor="subject-thumbnail" className="block text-sm font-medium text-secondary mb-1">
            Thumbnail URL
          </label>
          <input
            id="subject-thumbnail"
            name="thumbnail_url"
            type="text"
            defaultValue={subject.thumbnail_url || ""}
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
