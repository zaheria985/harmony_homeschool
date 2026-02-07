"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { createChild, updateChild, deleteChild } from "@/lib/actions/students";
import { useRouter } from "next/navigation";

type Child = {
  id: string;
  name: string;
  subject_count: number;
  total_lessons: number;
  completed_lessons: number;
};

export default function AdminChildrenClient({ children }: { children: Child[] }) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Child | null>(null);

  function openCreate() {
    setEditingChild(null);
    setName("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(child: Child) {
    setEditingChild(child);
    setName(child.name);
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);

    if (editingChild) {
      formData.set("id", editingChild.id);
      const result = await updateChild(formData);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
    } else {
      const result = await createChild(formData);
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

  async function handleDelete(child: Child) {
    setSubmitting(true);
    const result = await deleteChild(child.id);
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
          + Add Child
        </button>
      </div>

      {children.length === 0 ? (
        <EmptyState message="No children added yet" icon="👨‍🎓" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Subjects</th>
                  <th className="pb-3 font-medium">Lessons</th>
                  <th className="pb-3 font-medium">Completed</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {children.map((child) => (
                  <tr key={child.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{child.name}</td>
                    <td className="py-3 text-gray-600">{child.subject_count}</td>
                    <td className="py-3 text-gray-600">{child.total_lessons}</td>
                    <td className="py-3 text-gray-600">{child.completed_lessons}</td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => openEdit(child)}
                        className="mr-2 rounded px-2 py-1 text-xs text-primary-600 hover:bg-primary-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(child)}
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
        title={editingChild ? "Edit Child" : "Add Child"}
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
              placeholder="Child's name"
              autoFocus
            />
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
              {submitting ? "Saving..." : editingChild ? "Update" : "Create"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Child"
      >
        <p className="mb-2 text-sm text-gray-600">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>?
        </p>
        <p className="mb-4 text-sm text-red-600">
          This will permanently delete all their subjects, curricula, lessons, and completions.
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
