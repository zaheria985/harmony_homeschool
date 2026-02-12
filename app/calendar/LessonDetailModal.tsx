"use client";
import { useEffect, useState } from "react";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ResourcePreviewModal from "@/components/ui/ResourcePreviewModal";
import { markLessonComplete } from "@/lib/actions/completions";
type Resource = {
  id: string;
  type: string;
  url: string;
  title: string | null;
  page_number: number | null;
};
type LessonDetail = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  planned_date: string | null;
  curriculum_name: string;
  curriculum_id: string;
  subject_name: string;
  subject_color: string;
  subject_id: string;
  child_id: string;
  child_name: string;
  resources: Resource[];
  completion: { id: string; completed_at: string; child_id: string } | null;
};
export default function LessonDetailModal({
  lessonId,
  open,
  onClose,
  onEdit,
  onChanged,
  readOnly = false,
}: {
  lessonId: string | null;
  open: boolean;
  onClose: () => void;
  onEdit: (lesson: LessonDetail) => void;
  onChanged: () => void;
  readOnly?: boolean;
}) {
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [previewResource, setPreviewResource] = useState<{
    title: string;
    type: string;
    url: string | null;
  } | null>(null);
  useEffect(() => {
    if (!lessonId || !open) {
      setLesson(null);
      return;
    }
    setLoading(true);
    fetch(`/api/lessons/${lessonId}`)
      .then((r) => r.json())
      .then((data) => setLesson(data.lesson || null))
      .finally(() => setLoading(false));
  }, [lessonId, open]);
  async function handleComplete() {
    if (!lesson) return;
    setCompleting(true);
    setCompleteError(null);
    const fd = new FormData();
    fd.set("lessonId", lesson.id);
    fd.set("childId", lesson.child_id);
    try {
      const result = await markLessonComplete(fd);
      if (result?.error) {
        setCompleteError(result.error);
        return;
      }
      onChanged();
      onClose();
    } catch {
      setCompleteError("Failed to mark lesson complete");
    } finally {
      setCompleting(false);
    }
  }
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lesson?.title || "Lesson Details"}
    >
      {" "}
      {loading ? (
        <p className="text-gray-400 dark:text-slate-500">Loading...</p>
      ) : !lesson ? (
        <p className="text-gray-400 dark:text-slate-500">Lesson not found</p>
      ) : (
        <div className="space-y-4">
          {" "}
          {/* Subject & Curriculum */}{" "}
          <div className="flex items-center gap-2">
            {" "}
            <span
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: lesson.subject_color }}
            />{" "}
            <span className="text-sm font-medium text-primary">
              {lesson.subject_name}
            </span>{" "}
            <span className="text-sm text-gray-400">·</span>{" "}
            <span className="text-sm text-muted dark:text-slate-400">
              {lesson.curriculum_name}
            </span>{" "}
          </div>{" "}
          {/* Status & Date */}{" "}
          <div className="flex items-center gap-3">
            {" "}
            <Badge
              variant={
                lesson.status === "completed"
                  ? "success"
                  : lesson.status === "in_progress"
                    ? "warning"
                    : "default"
              }
            >
              {" "}
              {lesson.status.replace("_", "")}{" "}
            </Badge>{" "}
            {lesson.planned_date && (
              <span className="text-sm text-muted dark:text-slate-400">
                {" "}
                {new Date(lesson.planned_date + "T12:00:00").toLocaleDateString(
                  undefined,
                  { month: "short", day: "numeric", year: "numeric" },
                )}{" "}
              </span>
            )}{" "}
          </div>{" "}
          {/* Description */}{" "}
          {lesson.description && (
            <p className="text-sm text-tertiary">{lesson.description}</p>
          )}{" "}
          {/* Resources */}{" "}
          {lesson.resources.length > 0 && (
            <div>
              {" "}
              <h3 className="mb-2 text-sm font-medium text-secondary">
                Resources
              </h3>{" "}
              <div className="space-y-2">
                {" "}
                {lesson.resources.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() =>
                      setPreviewResource({
                        title: r.title || r.url,
                        type: r.type,
                        url: r.url,
                      })
                    }
                    className="flex w-full items-center gap-2 rounded-lg border border-light p-2 text-left text-sm hover:bg-surface-muted dark:hover:bg-slate-800"
                  >
                    {" "}
                    <span className="rounded bg-surface-subtle px-1.5 py-0.5 text-xs font-medium uppercase text-tertiary">
                      {" "}
                      {r.type}{" "}
                    </span>{" "}
                    <span className="truncate text-interactive">
                      {" "}
                      {r.title || r.url}{" "}
                    </span>{" "}
                  </button>
                ))}{" "}
              </div>{" "}
            </div>
          )}{" "}
          {/* Actions */}{" "}
          {completeError && (
            <p className="text-sm text-red-600 dark:text-red-400">
              {completeError}
            </p>
          )}{" "}
          <div className="flex gap-2 border-t border-light pt-4">
            {" "}
            {lesson.status !== "completed" && (
              <button
                onClick={handleComplete}
                disabled={completing}
                className="rounded-lg bg-[var(--success-bg)] px-4 py-2 text-sm font-medium text-[var(--success-text)] hover:bg-success-100 disabled:opacity-50/20 dark:hover:bg-success-900/30"
              >
                {" "}
                {completing ? "Completing..." : "Mark Complete"}{" "}
              </button>
            )}{" "}
            {!readOnly && (
              <button
                onClick={() => onEdit(lesson)}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted dark:hover:bg-slate-800"
              >
                {" "}
                Edit{" "}
              </button>
            )}{" "}
          </div>{" "}
        </div>
      )}{" "}
      <ResourcePreviewModal
        open={!!previewResource}
        onClose={() => setPreviewResource(null)}
        title={previewResource?.title || "Resource"}
        type={previewResource?.type || "link"}
        url={previewResource?.url || null}
      />{" "}
    </Modal>
  );
}
