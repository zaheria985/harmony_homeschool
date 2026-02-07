"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { createLesson, updateLesson } from "@/lib/actions/lessons";
import { addResource, deleteResource } from "@/lib/actions/resources";

type Child = { id: string; name: string };

type Resource = {
  id: string;
  type: string;
  url: string;
  title?: string | null;
};

type LessonData = {
  id: string;
  title: string;
  description?: string | null;
  planned_date?: string | null;
  curriculum_id: string;
  subject_name?: string;
  child_id?: string;
  resources?: Resource[];
};

type Subject = { id: string; name: string };
type Curriculum = { id: string; name: string };

export default function LessonFormModal({
  open,
  onClose,
  lesson,
  children,
}: {
  open: boolean;
  onClose: () => void;
  lesson?: LessonData | null;
  children: Child[];
}) {
  const isEdit = !!lesson;

  const [childId, setChildId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [curriculumId, setCurriculumId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [plannedDate, setPlannedDate] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (!open) return;
    setError("");
    setSubmitting(false);

    if (lesson) {
      setTitle(lesson.title);
      setDescription(lesson.description || "");
      setPlannedDate(
        lesson.planned_date
          ? new Date(lesson.planned_date).toISOString().split("T")[0]
          : ""
      );
      setCurriculumId(lesson.curriculum_id);
      // In edit mode, child/subject are pre-set and we load cascading data
      if (lesson.child_id) setChildId(lesson.child_id);
    } else {
      setTitle("");
      setDescription("");
      setPlannedDate("");
      setCurriculumId("");
      setChildId("");
      setSubjectId("");
      setSubjects([]);
      setCurricula([]);
    }
  }, [open, lesson]);

  // Load subjects when child changes
  useEffect(() => {
    if (!childId) {
      setSubjects([]);
      setSubjectId("");
      setCurricula([]);
      setCurriculumId(lesson?.curriculum_id || "");
      return;
    }
    fetch(`/api/subjects?childId=${childId}`)
      .then((r) => r.json())
      .then((data) => {
        setSubjects(data.subjects || []);
        if (!lesson) {
          setSubjectId("");
          setCurricula([]);
          setCurriculumId("");
        }
      });
  }, [childId, lesson]);

  // In edit mode, auto-select subject once subjects are loaded
  useEffect(() => {
    if (!lesson || subjects.length === 0 || !lesson.curriculum_id) return;
    // Find which subject contains this curriculum
    for (const s of subjects) {
      fetch(`/api/curricula?subjectId=${s.id}`)
        .then((r) => r.json())
        .then((data) => {
          const match = (data.curricula || []).find(
            (c: Curriculum) => c.id === lesson.curriculum_id
          );
          if (match) {
            setSubjectId(s.id);
            setCurricula(data.curricula);
            setCurriculumId(lesson.curriculum_id);
          }
        });
    }
  }, [subjects, lesson]);

  // Load curricula when subject changes (non-edit or user changes subject)
  useEffect(() => {
    if (!subjectId) {
      if (!lesson) {
        setCurricula([]);
        setCurriculumId("");
      }
      return;
    }
    fetch(`/api/curricula?subjectId=${subjectId}`)
      .then((r) => r.json())
      .then((data) => {
        setCurricula(data.curricula || []);
        if (!lesson) setCurriculumId("");
      });
  }, [subjectId, lesson]);

  // Resource state (edit mode only)
  const [resources, setResources] = useState<Resource[]>([]);
  const [showAddResource, setShowAddResource] = useState(false);
  const [resourceType, setResourceType] = useState("url");
  const [resourceUrl, setResourceUrl] = useState("");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceError, setResourceError] = useState("");

  useEffect(() => {
    if (open && lesson?.resources) {
      setResources(lesson.resources);
    } else if (!open) {
      setResources([]);
      setShowAddResource(false);
      setResourceError("");
    }
  }, [open, lesson]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.set("title", title);
    formData.set("curriculum_id", curriculumId);
    formData.set("planned_date", plannedDate);
    formData.set("description", description);

    if (isEdit && lesson) {
      formData.set("id", lesson.id);
      const result = await updateLesson(formData);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
    } else {
      const result = await createLesson(formData);
      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }
    }

    setSubmitting(false);
    onClose();
  }

  async function handleAddResource() {
    if (!lesson) return;
    setResourceError("");

    const formData = new FormData();
    formData.set("lesson_id", lesson.id);
    formData.set("type", resourceType);
    formData.set("url", resourceUrl);
    formData.set("title", resourceTitle);

    const result = await addResource(formData);
    if (result.error) {
      setResourceError(result.error);
      return;
    }

    // Optimistically add to list (won't have real ID, but close enough)
    setResources((prev) => [
      ...prev,
      { id: crypto.randomUUID(), type: resourceType, url: resourceUrl, title: resourceTitle || null },
    ]);
    setResourceUrl("");
    setResourceTitle("");
    setShowAddResource(false);
  }

  async function handleDeleteResource(resourceId: string) {
    const result = await deleteResource(resourceId);
    if (!result.error) {
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? "Edit Lesson" : "New Lesson"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Child selector */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Student
          </label>
          <select
            value={childId}
            onChange={(e) => setChildId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            required
            disabled={isEdit}
          >
            <option value="">Select a student...</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Subject selector */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Subject
          </label>
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            required
            disabled={!childId}
          >
            <option value="">Select a subject...</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Curriculum selector */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Curriculum
          </label>
          <select
            value={curriculumId}
            onChange={(e) => setCurriculumId(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            required
            disabled={!subjectId}
          >
            <option value="">Select a curriculum...</option>
            {curricula.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            required
            placeholder="Lesson title"
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
            className="w-full rounded-lg border px-3 py-2 text-sm"
            rows={3}
            placeholder="Optional description"
          />
        </div>

        {/* Planned date */}
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

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !curriculumId}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {submitting ? "Saving..." : isEdit ? "Update Lesson" : "Create Lesson"}
          </button>
        </div>
      </form>

      {/* Resources section (edit mode only) */}
      {isEdit && lesson && (
        <div className="mt-6 border-t pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">Resources</h3>
            <button
              type="button"
              onClick={() => setShowAddResource(!showAddResource)}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              {showAddResource ? "Cancel" : "+ Add Resource"}
            </button>
          </div>

          {resources.length > 0 && (
            <ul className="mb-3 space-y-2">
              {resources.map((r) => (
                <li key={r.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <span className="mr-2 inline-block rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium uppercase text-gray-600">
                      {r.type}
                    </span>
                    <span className="truncate text-gray-700">{r.title || r.url}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteResource(r.id)}
                    className="ml-2 shrink-0 text-xs text-red-500 hover:text-red-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {resources.length === 0 && !showAddResource && (
            <p className="mb-3 text-xs text-gray-400">No resources attached.</p>
          )}

          {showAddResource && (
            <div className="space-y-3 rounded-lg border bg-gray-50 p-3">
              <div className="flex gap-2">
                <select
                  value={resourceType}
                  onChange={(e) => setResourceType(e.target.value)}
                  className="rounded-lg border bg-white px-2 py-1.5 text-sm"
                >
                  <option value="url">URL</option>
                  <option value="youtube">YouTube</option>
                  <option value="pdf">PDF</option>
                  <option value="filerun">FileRun</option>
                </select>
                <input
                  type="url"
                  value={resourceUrl}
                  onChange={(e) => setResourceUrl(e.target.value)}
                  className="flex-1 rounded-lg border px-3 py-1.5 text-sm"
                  placeholder="https://..."
                  required
                />
              </div>
              <input
                type="text"
                value={resourceTitle}
                onChange={(e) => setResourceTitle(e.target.value)}
                className="w-full rounded-lg border px-3 py-1.5 text-sm"
                placeholder="Title (optional)"
              />
              {resourceError && <p className="text-xs text-red-600">{resourceError}</p>}
              <button
                type="button"
                onClick={handleAddResource}
                disabled={!resourceUrl}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700 disabled:opacity-50"
              >
                Add Resource
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
