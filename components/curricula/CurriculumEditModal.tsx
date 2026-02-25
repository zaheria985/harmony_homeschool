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
  subject_id: string;
  course_type: "curriculum" | "unit_study";
  grade_type?: "numeric" | "pass_fail";
  status: "active" | "archived" | "draft";
  start_date: string | null;
  end_date: string | null;
  notes?: string | null;
} | null;

type SubjectOption = { id: string; name: string };

export default function CurriculumEditModal({
  curriculum,
  subjects,
  onClose,
}: {
  curriculum: CurriculumForEdit;
  subjects: SubjectOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [coverImageFile, setCoverImageFile] = useState<File | null>(null);
  const [clearCoverImage, setClearCoverImage] = useState(false);

  if (!curriculum) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);

    const form = e.currentTarget;
    const formData = new FormData(form);

    if (coverImageFile) {
      formData.set("cover_image_file", coverImageFile);
    }
    if (clearCoverImage) {
      formData.set("clear_cover_image", "true");
    }

    const result = await updateCurriculum(formData);

    setSaving(false);
    if (result && "error" in result) {
      alert(result.error);
      return;
    }

    setCoverImageFile(null);
    setClearCoverImage(false);
    router.refresh();
    onClose();
  }

  const inputClass =
    "w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus";

  return (
    <Modal open={!!curriculum} onClose={onClose} title="Edit Course">
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="id" value={curriculum.id} />

        {/* Name */}
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
            className={inputClass}
          />
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="curriculum-subject" className="block text-sm font-medium text-secondary mb-1">
            Subject
          </label>
          <select
            id="curriculum-subject"
            name="subject_id"
            defaultValue={curriculum.subject_id}
            className={inputClass}
          >
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        {/* Course Type */}
        <div>
          <label htmlFor="curriculum-course-type" className="block text-sm font-medium text-secondary mb-1">
            Course Type
          </label>
          <select
            id="curriculum-course-type"
            name="course_type"
            defaultValue={curriculum.course_type}
            className={inputClass}
          >
            <option value="curriculum">Curriculum</option>
            <option value="unit_study">Unit Study</option>
          </select>
        </div>

        {/* Grade Type */}
        <div>
          <label htmlFor="curriculum-grade-type" className="block text-sm font-medium text-secondary mb-1">
            Grade Type
          </label>
          <select
            id="curriculum-grade-type"
            name="grade_type"
            defaultValue={curriculum.grade_type || "numeric"}
            className={inputClass}
          >
            <option value="numeric">Numeric</option>
            <option value="pass_fail">Pass / Fail</option>
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="curriculum-status" className="block text-sm font-medium text-secondary mb-1">
            Status
          </label>
          <select
            id="curriculum-status"
            name="status"
            defaultValue={curriculum.status}
            className={inputClass}
          >
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        {/* Start Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="curriculum-start-date" className="block text-sm font-medium text-secondary mb-1">
              Start Date
            </label>
            <input
              id="curriculum-start-date"
              name="start_date"
              type="date"
              defaultValue={curriculum.start_date || ""}
              className={inputClass}
            />
          </div>

          {/* End Date */}
          <div>
            <label htmlFor="curriculum-end-date" className="block text-sm font-medium text-secondary mb-1">
              End Date
            </label>
            <input
              id="curriculum-end-date"
              name="end_date"
              type="date"
              defaultValue={curriculum.end_date || ""}
              className={inputClass}
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="curriculum-description" className="block text-sm font-medium text-secondary mb-1">
            Description
          </label>
          <textarea
            id="curriculum-description"
            name="description"
            rows={3}
            defaultValue={curriculum.description || ""}
            className={inputClass}
          />
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="curriculum-notes" className="block text-sm font-medium text-secondary mb-1">
            Notes
          </label>
          <textarea
            id="curriculum-notes"
            name="notes"
            rows={3}
            defaultValue={curriculum.notes || ""}
            className={inputClass}
          />
        </div>

        {/* Cover Image */}
        <div>
          <label className="block text-sm font-medium text-secondary mb-1">
            Cover Image
          </label>

          {curriculum.cover_image && !clearCoverImage && (
            <div className="mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={curriculum.cover_image}
                alt="Current cover"
                className="h-24 w-auto rounded-lg border border-light object-cover"
              />
            </div>
          )}

          <input
            type="file"
            accept="image/*"
            onChange={(e) => {
              setCoverImageFile(e.target.files?.[0] || null);
              if (e.target.files?.[0]) {
                setClearCoverImage(false);
              }
            }}
            className="w-full text-sm text-primary file:mr-3 file:rounded-lg file:border-0 file:bg-interactive file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:opacity-90"
          />

          {curriculum.cover_image && (
            <label className="mt-2 flex items-center gap-2 text-sm text-secondary">
              <input
                type="checkbox"
                checked={clearCoverImage}
                onChange={(e) => {
                  setClearCoverImage(e.target.checked);
                  if (e.target.checked) {
                    setCoverImageFile(null);
                  }
                }}
                className="rounded border-light"
              />
              Clear existing cover image
            </label>
          )}
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
