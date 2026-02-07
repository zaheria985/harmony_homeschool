"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { createCurriculum, updateCurriculum, deleteCurriculum } from "@/lib/actions/lessons";
import { useRouter } from "next/navigation";

type Curriculum = {
  id: string;
  name: string;
  description: string | null;
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  child_name: string | null;
  child_id: string | null;
  lesson_count: number;
};

type Child = { id: string; name: string };
type Subject = { id: string; name: string };

export default function AdminCurriculaClient({
  curricula,
  children,
}: {
  curricula: Curriculum[];
  children: Child[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Curriculum | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Curriculum | null>(null);

  // Load global subjects when modal opens for create
  useEffect(() => {
    if (!modalOpen || editing) return;
    fetch(`/api/subjects`)
      .then((r) => r.json())
      .then((data) => {
        setSubjects(data.subjects || []);
      });
  }, [modalOpen, editing]);

  function openCreate() {
    setEditing(null);
    setName("");
    setDescription("");
    setSubjectId("");
    setError("");
    setModalOpen(true);
  }

  function openEdit(curriculum: Curriculum) {
    setEditing(curriculum);
    setName(curriculum.name);
    setDescription(curriculum.description || "");
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("description", description);

    if (editing) {
      formData.set("id", editing.id);
      const result = await updateCurriculum(formData);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
    } else {
      formData.set("subject_id", subjectId);
      const result = await createCurriculum(formData);
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

  async function handleDelete(curriculum: Curriculum) {
    setSubmitting(true);
    const result = await deleteCurriculum(curriculum.id);
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
          + Add Curriculum
        </button>
      </div>

      {curricula.length === 0 ? (
        <EmptyState message="No curricula added yet" icon="📋" />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Subject</th>
                  <th className="pb-3 font-medium">Assigned To</th>
                  <th className="pb-3 font-medium">Lessons</th>
                  <th className="pb-3 font-medium">Description</th>
                  <th className="pb-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {curricula.map((curriculum) => (
                  <tr key={curriculum.id} className="border-b last:border-0">
                    <td className="py-3 font-medium">{curriculum.name}</td>
                    <td className="py-3 text-gray-600">{curriculum.subject_name}</td>
                    <td className="py-3 text-gray-600">{curriculum.child_name || "Unassigned"}</td>
                    <td className="py-3 text-gray-600">{curriculum.lesson_count}</td>
                    <td className="max-w-xs truncate py-3 text-gray-500">
                      {curriculum.description || "—"}
                    </td>
                    <td className="py-3 text-right">
                      <button
                        onClick={() => openEdit(curriculum)}
                        className="mr-2 rounded px-2 py-1 text-xs text-primary-600 hover:bg-primary-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setConfirmDelete(curriculum)}
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
        title={editing ? "Edit Curriculum" : "Add Curriculum"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Subject</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                required
              >
                <option value="">Select a subject...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
              placeholder="e.g. Unit 1: Algebra, Saxon Math Chapter 3"
              autoFocus={!!editing}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              placeholder="Optional description"
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
              disabled={submitting || (!editing && !subjectId)}
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
        title="Delete Curriculum"
      >
        <p className="mb-2 text-sm text-gray-600">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong> ({confirmDelete?.subject_name})?
        </p>
        <p className="mb-4 text-sm text-red-600">
          This will permanently delete all {confirmDelete?.lesson_count} lessons within this curriculum.
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
