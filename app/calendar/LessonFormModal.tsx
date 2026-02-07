"use client";

import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import { createLesson, updateLesson } from "@/lib/actions/lessons";
import SubjectFormModal from "./SubjectFormModal";
import CurriculumFormModal from "./CurriculumFormModal";

type Subject = { id: string; name: string; color: string; school_year_id: string };
type Curriculum = { id: string; name: string; description: string | null };
type ResourceRow = { type: string; url: string; title: string };

type EditData = {
  id: string;
  title: string;
  description: string | null;
  planned_date: string | null;
  curriculum_id: string;
  subject_id: string;
  resources: { id: string; type: string; url: string; title: string | null }[];
} | null;

export default function LessonFormModal({
  open,
  onClose,
  childId,
  defaultDate,
  editData,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  childId: string;
  defaultDate?: string;
  editData?: EditData;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [curriculumId, setCurriculumId] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showNewSubject, setShowNewSubject] = useState(false);
  const [showNewCurriculum, setShowNewCurriculum] = useState(false);

  // Load subjects
  useEffect(() => {
    if (!childId || !open) return;
    fetch(`/api/subjects?childId=${childId}`)
      .then((r) => r.json())
      .then((data) => setSubjects(data.subjects || []));
  }, [childId, open]);

  // Load curricula when subject changes
  useEffect(() => {
    if (!subjectId) {
      setCurricula([]);
      setCurriculumId("");
      return;
    }
    fetch(`/api/curricula?subjectId=${subjectId}`)
      .then((r) => r.json())
      .then((data) => setCurricula(data.curricula || []));
  }, [subjectId]);

  // Populate form for edit mode
  useEffect(() => {
    if (open && editData) {
      setTitle(editData.title);
      setDescription(editData.description || "");
      setSubjectId(editData.subject_id);
      setCurriculumId(editData.curriculum_id);
      setPlannedDate(editData.planned_date?.split("T")[0] || "");
      setResources(
        editData.resources.map((r) => ({
          type: r.type,
          url: r.url,
          title: r.title || "",
        }))
      );
    } else if (open) {
      setTitle("");
      setDescription("");
      setSubjectId("");
      setCurriculumId("");
      setPlannedDate(defaultDate || "");
      setResources([]);
    }
    setError("");
  }, [open, editData, defaultDate]);

  function addResource() {
    setResources([...resources, { type: "url", url: "", title: "" }]);
  }

  function removeResource(idx: number) {
    setResources(resources.filter((_, i) => i !== idx));
  }

  function updateResource(idx: number, field: keyof ResourceRow, value: string) {
    setResources(resources.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    const fd = new FormData();
    if (editData) fd.set("id", editData.id);
    fd.set("title", title);
    fd.set("curriculum_id", curriculumId);
    fd.set("planned_date", plannedDate);
    fd.set("description", description);

    const result = editData ? await updateLesson(fd) : await createLesson(fd);

    if ("error" in result && result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Save resources via API if this is a new lesson
    // For now, resources are saved on the lesson detail page — the form captures them
    // but actual resource insertion would need a separate server action.
    // TODO: Add resource saving in a follow-up

    setSaving(false);
    onSaved();
    onClose();
  }

  function handleSubjectCreated(newId: string) {
    // Refresh subjects list
    fetch(`/api/subjects?childId=${childId}`)
      .then((r) => r.json())
      .then((data) => {
        setSubjects(data.subjects || []);
        setSubjectId(newId);
      });
    setShowNewSubject(false);
  }

  function handleCurriculumCreated(newId: string) {
    // Refresh curricula list
    if (subjectId) {
      fetch(`/api/curricula?subjectId=${subjectId}`)
        .then((r) => r.json())
        .then((data) => {
          setCurricula(data.curricula || []);
          setCurriculumId(newId);
        });
    }
    setShowNewCurriculum(false);
  }

  const schoolYearId = subjects.find((s) => s.id === subjectId)?.school_year_id
    || subjects[0]?.school_year_id || "";

  return (
    <>
      <Modal
        open={open && !showNewSubject && !showNewCurriculum}
        onClose={onClose}
        title={editData ? "Edit Lesson" : "New Lesson"}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{error}</p>
          )}

          {/* Title */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Subject <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                required
                className="flex-1 rounded-lg border px-3 py-2 text-sm"
              >
                <option value="">Select subject...</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewSubject(true)}
                className="whitespace-nowrap rounded-lg border px-3 py-2 text-sm text-primary-600 hover:bg-primary-50"
              >
                + New
              </button>
            </div>
          </div>

          {/* Curriculum */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Curriculum <span className="text-red-400">*</span>
            </label>
            <div className="flex gap-2">
              <select
                value={curriculumId}
                onChange={(e) => setCurriculumId(e.target.value)}
                required
                disabled={!subjectId}
                className="flex-1 rounded-lg border px-3 py-2 text-sm disabled:bg-gray-50"
              >
                <option value="">
                  {subjectId ? "Select curriculum..." : "Select a subject first"}
                </option>
                {curricula.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowNewCurriculum(true)}
                disabled={!subjectId}
                className="whitespace-nowrap rounded-lg border px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 disabled:opacity-50"
              >
                + New
              </button>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Planned Date
            </label>
            <input
              type="date"
              value={plannedDate}
              onChange={(e) => setPlannedDate(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
          </div>

          {/* Resources */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Resources</label>
              <button
                type="button"
                onClick={addResource}
                className="text-sm text-primary-600 hover:text-primary-700"
              >
                + Add Resource
              </button>
            </div>
            {resources.map((r, idx) => (
              <div key={idx} className="mb-2 flex gap-2">
                <select
                  value={r.type}
                  onChange={(e) => updateResource(idx, "type", e.target.value)}
                  className="rounded-lg border px-2 py-1.5 text-sm"
                >
                  <option value="url">URL</option>
                  <option value="youtube">YouTube</option>
                  <option value="pdf">PDF</option>
                  <option value="filerun">FileRun</option>
                </select>
                <input
                  type="url"
                  value={r.url}
                  onChange={(e) => updateResource(idx, "url", e.target.value)}
                  placeholder="URL"
                  className="flex-1 rounded-lg border px-2 py-1.5 text-sm"
                />
                <input
                  type="text"
                  value={r.title}
                  onChange={(e) => updateResource(idx, "title", e.target.value)}
                  placeholder="Title"
                  className="w-32 rounded-lg border px-2 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeResource(idx)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          {/* Submit */}
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
              {saving ? "Saving..." : editData ? "Update Lesson" : "Create Lesson"}
            </button>
          </div>
        </form>
      </Modal>

      <SubjectFormModal
        open={showNewSubject}
        onClose={() => setShowNewSubject(false)}
        onCreated={handleSubjectCreated}
      />

      <CurriculumFormModal
        open={showNewCurriculum}
        onClose={() => setShowNewCurriculum(false)}
        subjectId={subjectId}
        onCreated={handleCurriculumCreated}
      />
    </>
  );
}
