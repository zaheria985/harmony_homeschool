"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { createSubject, updateSubject, deleteSubject } from "@/lib/actions/lessons";
import { useRouter } from "next/navigation";

const COLOR_OPTIONS = [
  { value: "indigo-500", label: "Indigo" },
  { value: "emerald-500", label: "Emerald" },
  { value: "amber-500", label: "Amber" },
  { value: "rose-500", label: "Rose" },
  { value: "sky-500", label: "Sky" },
  { value: "purple-500", label: "Purple" },
  { value: "orange-500", label: "Orange" },
  { value: "teal-500", label: "Teal" },
];

type Subject = {
  id: string;
  name: string;
  color: string | null;
  curriculum_count: number;
  lesson_count: number;
};

export default function AdminSubjectsClient({
  subjects,
}: {
  subjects: Subject[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Subject | null>(null);

  function openCreate() {
    setEditing(null);
    setName("");
    setColor("indigo-500");
    setError("");
    setModalOpen(true);
  }

  function openEdit(subject: Subject) {
    setEditing(subject);
    setName(subject.name);
    setColor(subject.color || "indigo-500");
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("color", color);

    if (editing) {
      formData.set("id", editing.id);
      const result = await updateSubject(formData);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
    } else {
      const result = await createSubject(formData);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    setModalOpen(false);
    router.refresh();
  }

  async function handleDelete(subject: Subject) {
    setSubmitting(true);
    const result = await deleteSubject(subject.id);
    if (result.error) {
      setError(result.error);
    }
    setSubmitting(false);
    setConfirmDelete(null);
    router.refresh();
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          + Add Subject
        </button>
      </div>

      {subjects.length === 0 ? (
        <EmptyState message="No subjects added yet" icon="📖" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-3 font-medium">Color</th>
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Curricula</th>
                  <th className="pb-3 font-medium">Lessons</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {subjects.map((subject) => (
                  <tr key={subject.id} className="border-b last:border-0">
                    <td className="py-3">
                      <span
                        className={`inline-block h-4 w-4 rounded-full bg-${subject.color || "gray-400"}`}
                      />
                    </td>
                    <td className="py-3 font-medium">{subject.name}</td>
                    <td className="py-3 text-gray-600">{subject.curriculum_count}</td>
                    <td className="py-3 text-gray-600">{subject.lesson_count}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => openEdit(subject)}
                        className="mr-2 rounded px-2 py-1 text-xs text-primary-600 hover:bg-primary-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(subject)}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Subject" : "Add Subject"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
              placeholder="e.g. Math, Science, History"
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${
                    color === c.value
                      ? "border-primary-500 bg-primary-50 font-medium"
                      : "border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <span className={`inline-block h-3 w-3 rounded-full bg-${c.value}`} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? "Saving..." : editing ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Subject"
      >
        <p className="mb-2 text-sm text-gray-600">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
        </p>
        <p className="mb-4 text-sm text-red-600">
          This will permanently delete all curricula and lessons within this subject.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={() => confirmDelete && handleDelete(confirmDelete)}
            disabled={submitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {submitting ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
