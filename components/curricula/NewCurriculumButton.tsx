"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { createCurriculum } from "@/lib/actions/lessons";

type Child = { id: string; name: string };
type Subject = { id: string; name: string };
type SchoolYear = { id: string; label: string };

export default function NewCurriculumButton({
  children,
  schoolYears,
}: {
  children: Child[];
  schoolYears: SchoolYear[];
}) {
  const [open, setOpen] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [childId, setChildId] = useState("");
  const [yearId, setYearId] = useState(schoolYears[0]?.id || "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [courseType, setCourseType] = useState<"curriculum" | "unit_study">(
    "curriculum",
  );
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setSubjectId("");
    setChildId("");
    setYearId(schoolYears[0]?.id || "");
    setName("");
    setDescription("");
    setCourseType("curriculum");
    setError("");
    setSubmitting(false);
  }

  // Load all global subjects on open
  useEffect(() => {
    if (!open) return;
    fetch(`/api/subjects`)
      .then((r) => r.json())
      .then((data) => {
        setSubjects(data.subjects || []);
      });
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    const formData = new FormData();
    formData.set("name", name);
    formData.set("subject_id", subjectId);
    formData.set("description", description);
    formData.set("course_type", courseType);
    if (childId) formData.set("child_id", childId);
    if (yearId) formData.set("school_year_id", yearId);

    const result = await createCurriculum(formData);
    if ("error" in result) {
      setError(result.error || "Failed to create curriculum");
      setSubmitting(false);
      return;
    }

    reset();
    setOpen(false);
  }

  return (
    <>
      <button
        onClick={() => {
          reset();
          setOpen(true);
        }}
        className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
      >
        + New Course
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="New Course">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Subject
            </label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            >
              <option value="">Select a subject...</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
              placeholder="e.g. Unit 3: Fractions"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
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

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Course Type
            </label>
            <select
              value={courseType}
              onChange={(e) =>
                setCourseType(e.target.value as "curriculum" | "unit_study")
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="curriculum">Curriculum</option>
              <option value="unit_study">Unit Study</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Assign to Student (optional)
            </label>
            <select
              value={childId}
              onChange={(e) => setChildId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="">No assignment</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {childId && (
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                School Year
              </label>
              <select
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
                required
              >
                {schoolYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !subjectId || !name}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Create Course"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
