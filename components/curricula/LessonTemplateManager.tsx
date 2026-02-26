"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import {
  getLessonTemplates,
  applyLessonTemplate,
  saveAsTemplate,
  deleteLessonTemplate,
} from "@/lib/actions/templates";

type Template = {
  id: string;
  name: string;
  description: string | null;
  lessons: { title: string; description: string; order_index: number }[];
  created_at: string;
  updated_at: string;
};

export default function LessonTemplateManager({
  curriculumId,
  lessonCount,
}: {
  curriculumId: string;
  lessonCount: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showModal, setShowModal] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Save-as-template state
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);

  // Expanded template preview
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadTemplates() {
    setLoading(true);
    try {
      const data = await getLessonTemplates();
      setTemplates(data);
    } catch {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (showModal) {
      loadTemplates();
      setError("");
      setSuccessMsg("");
      setShowSaveForm(false);
      setSaveName("");
      setExpandedId(null);
    }
  }, [showModal]);

  async function handleApply(templateId: string) {
    setError("");
    setSuccessMsg("");
    const fd = new FormData();
    fd.set("templateId", templateId);
    fd.set("curriculumId", curriculumId);
    startTransition(async () => {
      const result = await applyLessonTemplate(fd);
      if (result.error) {
        setError(result.error);
      } else {
        const tpl = templates.find((t) => t.id === templateId);
        setSuccessMsg(
          `Applied "${tpl?.name}" - ${tpl?.lessons.length} lessons created`
        );
        router.refresh();
      }
    });
  }

  async function handleSaveAsTemplate() {
    if (!saveName.trim()) return;
    setError("");
    setSuccessMsg("");
    setSaving(true);
    const fd = new FormData();
    fd.set("curriculumId", curriculumId);
    fd.set("name", saveName.trim());
    const result = await saveAsTemplate(fd);
    setSaving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccessMsg(`Saved ${lessonCount} lessons as template "${saveName.trim()}"`);
      setSaveName("");
      setShowSaveForm(false);
      loadTemplates();
    }
  }

  async function handleDelete(templateId: string) {
    setError("");
    setSuccessMsg("");
    const fd = new FormData();
    fd.set("id", templateId);
    const result = await deleteLessonTemplate(fd);
    if (result.error) {
      setError(result.error);
    } else {
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      setSuccessMsg("Template deleted");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-light px-3 py-1.5 text-sm text-secondary hover:bg-surface-muted transition-colors"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        Templates
      </button>

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Lesson Templates"
      >
        <div className="space-y-4">
          {/* Status messages */}
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
              {successMsg}
            </div>
          )}

          {/* Template list */}
          {loading ? (
            <p className="py-4 text-center text-sm text-muted">
              Loading templates...
            </p>
          ) : templates.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-muted">No templates yet.</p>
              <p className="mt-1 text-xs text-muted">
                Save your current lessons as a template to reuse them in other
                curricula.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((tpl) => (
                <div
                  key={tpl.id}
                  className="rounded-lg border border-light bg-surface"
                >
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(expandedId === tpl.id ? null : tpl.id)
                      }
                      className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    >
                      <svg
                        className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform ${expandedId === tpl.id ? "rotate-90" : ""}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m8.25 4.5 7.5 7.5-7.5 7.5"
                        />
                      </svg>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-primary">
                          {tpl.name}
                        </p>
                        <p className="text-xs text-muted">
                          {tpl.lessons.length} lesson
                          {tpl.lessons.length !== 1 ? "s" : ""}
                          {tpl.description ? ` \u2014 ${tpl.description}` : ""}
                        </p>
                      </div>
                    </button>
                    <div className="flex shrink-0 items-center gap-1.5 ml-2">
                      <button
                        type="button"
                        onClick={() => handleApply(tpl.id)}
                        disabled={isPending}
                        className="rounded bg-interactive px-2.5 py-1 text-xs font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
                      >
                        {isPending ? "Applying..." : "Apply"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tpl.id)}
                        className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
                    </div>
                  </div>

                  {/* Expanded preview */}
                  {expandedId === tpl.id && (
                    <div className="border-t border-light px-3 py-2">
                      <ol className="space-y-1">
                        {tpl.lessons
                          .sort((a, b) => a.order_index - b.order_index)
                          .map((lesson, i) => (
                            <li
                              key={i}
                              className="flex items-start gap-2 text-xs"
                            >
                              <span className="mt-0.5 shrink-0 font-mono text-muted">
                                {i + 1}.
                              </span>
                              <div className="min-w-0">
                                <span className="font-medium text-secondary">
                                  {lesson.title}
                                </span>
                                {lesson.description && (
                                  <span className="ml-1 text-muted">
                                    &mdash; {lesson.description}
                                  </span>
                                )}
                              </div>
                            </li>
                          ))}
                      </ol>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-light pt-3">
            {showSaveForm ? (
              <div className="space-y-2">
                <label className="block text-sm font-medium text-secondary">
                  Save current lessons as template
                </label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full rounded-lg border border-light bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-interactive focus:outline-none focus:ring-1 focus:ring-focus"
                  placeholder="Template name..."
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveAsTemplate}
                    disabled={saving || !saveName.trim()}
                    className="rounded-lg bg-interactive px-3 py-1.5 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
                  >
                    {saving ? "Saving..." : `Save ${lessonCount} Lessons as Template`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowSaveForm(false);
                      setSaveName("");
                    }}
                    className="rounded-lg px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowSaveForm(true)}
                disabled={lessonCount === 0}
                className="w-full rounded-lg border border-dashed border-light px-3 py-2 text-sm text-secondary hover:border-interactive hover:text-interactive disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
              >
                {lessonCount > 0
                  ? `Save Current ${lessonCount} Lessons as Template`
                  : "No lessons to save as template"}
              </button>
            )}
          </div>
        </div>
      </Modal>
    </>
  );
}
