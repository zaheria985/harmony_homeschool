"use client";

import { useState, useEffect } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { ClipboardList } from "lucide-react";
import {
  createCurriculum,
  updateCurriculum,
  deleteCurriculum,
  assignCurriculum,
} from "@/lib/actions/lessons";
import { useRouter } from "next/navigation";
import ScheduleSection from "@/components/curricula/ScheduleSection";

type Curriculum = {
  id: string;
  name: string;
  description: string | null;
  cover_image: string | null;
  course_type: "curriculum" | "unit_study";
  status: "active" | "archived" | "draft";
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  child_name: string | null;
  child_id: string | null;
  lesson_count: number;
};

type Child = { id: string; name: string };
type Subject = { id: string; name: string };

type ScheduleAssignment = {
  assignmentId: string;
  childId: string;
  childName: string;
  configuredWeekdays: number[];
  schoolWeekdays: number[];
};

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
  const [status, setStatus] = useState<"active" | "archived" | "draft">(
    "active",
  );
  const [courseType, setCourseType] = useState<"curriculum" | "unit_study">(
    "curriculum",
  );
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [subjectId, setSubjectId] = useState("");
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [clearCoverImage, setClearCoverImage] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Curriculum | null>(null);
  const [assignForCurriculum, setAssignForCurriculum] = useState<Curriculum | null>(null);
  const [assignChildId, setAssignChildId] = useState("");
  const [assignSchoolYearId, setAssignSchoolYearId] = useState("");
  const [schoolYears, setSchoolYears] = useState<{ id: string; name: string }[]>([]);
  const [scheduleForCurriculum, setScheduleForCurriculum] = useState<
    Curriculum | null
  >(null);
  const [scheduleAssignments, setScheduleAssignments] = useState<
    ScheduleAssignment[]
  >([]);
  const [scheduleUnscheduledCount, setScheduleUnscheduledCount] = useState(0);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [scheduleError, setScheduleError] = useState("");

  // Load global subjects when modal opens
  useEffect(() => {
    if (!modalOpen) return;
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
    setStatus("active");
    setCourseType("curriculum");
    setStartDate("");
    setEndDate("");
    setNotes("");
    setSubjectId("");
    setCoverImageFile(null);
    setClearCoverImage(false);
    setError("");
    setModalOpen(true);
  }

  function openEdit(curriculum: Curriculum) {
    setEditing(curriculum);
    setName(curriculum.name);
    setDescription(curriculum.description || "");
    setStatus(curriculum.status || "active");
    setCourseType(curriculum.course_type || "curriculum");
    setStartDate(curriculum.start_date || "");
    setEndDate(curriculum.end_date || "");
    setNotes(curriculum.notes || "");
    setSubjectId(curriculum.subject_id);
    setCoverImageFile(null);
    setClearCoverImage(false);
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
    formData.set("subject_id", subjectId);
    formData.set("course_type", courseType);
    formData.set("status", status);
    formData.set("start_date", startDate);
    formData.set("end_date", endDate);
    formData.set("notes", notes);
    formData.set("clear_cover_image", clearCoverImage ? "true" : "false");
    if (editing?.cover_image) {
      formData.set("cover_image", editing.cover_image);
    }
    if (coverImageFile) {
      formData.set("cover_image_file", coverImageFile);
    }

    if (editing) {
      formData.set("id", editing.id);
      const result = await updateCurriculum(formData);
      if ("error" in result) {
        setError(result.error || "Failed to update curriculum");
        setSubmitting(false);
        return;
      }
    } else {
      const result = await createCurriculum(formData);
      if ("error" in result) {
        setError(result.error || "Failed to create curriculum");
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
    if ("error" in result) {
      setError(result.error || "Failed to delete curriculum");
    }
    setSubmitting(false);
    setConfirmDelete(null);
    router.refresh();
  }

  async function openAssign(curriculum: Curriculum) {
    setAssignForCurriculum(curriculum);
    setAssignChildId("");
    setAssignSchoolYearId("");
    setError("");
    try {
      const res = await fetch("/api/school-years");
      const data = await res.json();
      setSchoolYears(data.schoolYears || []);
    } catch {
      setError("Failed to load school years");
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault();
    if (!assignForCurriculum) return;
    setError("");
    setSubmitting(true);
    const formData = new FormData();
    formData.set("curriculum_id", assignForCurriculum.id);
    formData.set("child_id", assignChildId);
    formData.set("school_year_id", assignSchoolYearId);
    const result = await assignCurriculum(formData);
    if ("error" in result) {
      setError(result.error || "Failed to assign");
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    setAssignForCurriculum(null);
    router.refresh();
  }

  async function openSchedule(curriculum: Curriculum) {
    setScheduleForCurriculum(curriculum);
    setScheduleAssignments([]);
    setScheduleUnscheduledCount(0);
    setScheduleError("");
    setScheduleLoading(true);

    try {
      const res = await fetch(`/api/admin/curricula/${curriculum.id}/schedule`);
      const data = await res.json();
      if (!res.ok || data.error) {
        setScheduleError(data.error || "Failed to load schedule settings");
        setScheduleLoading(false);
        return;
      }
      setScheduleAssignments(data.assignments || []);
      setScheduleUnscheduledCount(data.unscheduledCount || 0);
    } catch {
      setScheduleError("Failed to load schedule settings");
    } finally {
      setScheduleLoading(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          onClick={openCreate}
          className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
        >
          + Add Course
        </button>
      </div>

      {curricula.length === 0 ? (
        <EmptyState message="No curricula added yet" icon={<ClipboardList size={28} />} />
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-muted">
                  <th className="pb-3 font-medium">Name</th>
                  <th className="pb-3 font-medium">Type</th>
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
                    <td className="py-3 text-tertiary capitalize">
                      {curriculum.course_type.replace("_", " ")}
                    </td>
                    <td className="py-3 text-tertiary">
                      {curriculum.subject_name}
                    </td>
                    <td className="py-3 text-tertiary">
                      {curriculum.child_name || "Unassigned"}
                    </td>
                    <td className="py-3 text-tertiary">
                      {curriculum.lesson_count}
                    </td>
                    <td className="max-w-xs truncate py-3 text-muted">
                      {curriculum.description || "—"}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openEdit(curriculum)}
                          aria-label={`Edit ${curriculum.name}`}
                          title="Edit"
                          className="rounded px-2 py-1 text-xs text-tertiary hover:bg-surface-muted"
                        >
                          ✎
                        </button>
                        <button
                          onClick={() => openSchedule(curriculum)}
                          aria-label={`Schedule ${curriculum.name}`}
                          title="Schedule"
                          className="rounded px-2 py-1 text-xs text-tertiary hover:bg-surface-muted"
                        >
                          📅
                        </button>
                        <button
                          onClick={() => openAssign(curriculum)}
                          aria-label={`Assign ${curriculum.name}`}
                          title="Assign"
                          className="rounded px-2 py-1 text-xs text-tertiary hover:bg-surface-muted"
                        >
                          👤
                        </button>
                        <button
                          onClick={() => setConfirmDelete(curriculum)}
                          aria-label={`Delete ${curriculum.name}`}
                          title="Delete"
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)]"
                        >
                          🗑
                        </button>
                      </div>
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
        title={editing ? "Edit Course" : "Add Course"}
      >
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
              placeholder="e.g. Unit 1: Algebra, Saxon Math Chapter 3"
              autoFocus={!!editing}
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
              Status
            </label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "archived" | "draft")
              }
              className="w-full rounded-lg border px-3 py-2 text-sm"
            >
              <option value="active">Active</option>
              <option value="archived">Archived</option>
              <option value="draft">Draft</option>
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              rows={3}
              placeholder="Optional internal notes"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Cover Photo <span className="text-muted">(optional)</span>
            </label>
            {editing?.cover_image && !clearCoverImage && !coverImageFile && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border bg-surface-muted p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={editing.cover_image}
                  alt={editing.name}
                  className="h-10 w-10 rounded object-cover"
                />
                <span className="text-xs text-muted">Current cover image</span>
              </div>
            )}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setCoverImageFile(e.target.files?.[0] || null);
                if (e.target.files?.[0]) setClearCoverImage(false);
              }}
              className="w-full rounded-lg border px-3 py-2 text-sm"
            />
            {editing?.cover_image && (
              <label className="mt-2 flex items-center gap-2 text-xs text-tertiary">
                <input
                  type="checkbox"
                  checked={clearCoverImage}
                  onChange={(e) => {
                    setClearCoverImage(e.target.checked);
                    if (e.target.checked) setCoverImageFile(null);
                  }}
                />
                Remove current cover image
              </label>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !subjectId}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
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
        title="Delete Course"
      >
        <p className="mb-2 text-sm text-tertiary">
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>{" "}
          ({confirmDelete?.subject_name})?
        </p>
        <p className="mb-4 text-sm text-red-600">
          This will permanently delete all {confirmDelete?.lesson_count} lessons
          within this course.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setConfirmDelete(null)}
            className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
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

      {/* Assign Modal */}
      <Modal
        open={!!assignForCurriculum}
        onClose={() => setAssignForCurriculum(null)}
        title={`Assign: ${assignForCurriculum?.name || "Course"}`}
      >
        <form onSubmit={handleAssign} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">Student</label>
            <select
              value={assignChildId}
              onChange={(e) => setAssignChildId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            >
              <option value="">Select a student...</option>
              {children.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">School Year</label>
            <select
              value={assignSchoolYearId}
              onChange={(e) => setAssignSchoolYearId(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm"
              required
            >
              <option value="">Select a school year...</option>
              {schoolYears.map((sy) => (
                <option key={sy.id} value={sy.id}>{sy.name}</option>
              ))}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setAssignForCurriculum(null)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !assignChildId || !assignSchoolYearId}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {submitting ? "Assigning..." : "Assign"}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        open={!!scheduleForCurriculum}
        onClose={() => {
          setScheduleForCurriculum(null);
          setScheduleAssignments([]);
          setScheduleError("");
        }}
        title={`Schedule: ${scheduleForCurriculum?.name || "Course"}`}
      >
        {scheduleLoading ? (
          <p className="text-sm text-muted">Loading schedule settings...</p>
        ) : scheduleError ? (
          <p className="text-sm text-red-600">{scheduleError}</p>
        ) : scheduleForCurriculum ? (
          <ScheduleSection
            curriculumId={scheduleForCurriculum.id}
            assignments={scheduleAssignments}
            unscheduledCount={scheduleUnscheduledCount}
          />
        ) : null}
      </Modal>
    </>
  );
}
