"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { generateCurriculumPlan } from "@/lib/actions/ai";
import { createLesson } from "@/lib/actions/lessons";

type Props = {
  curriculumId: string;
  subjectName: string;
};

const gradeLevels = [
  "Pre-K",
  "Kindergarten",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
];

export default function AICurriculumPlanModal({ curriculumId, subjectName }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [gradeLevel, setGradeLevel] = useState("3rd");
  const [weeks, setWeeks] = useState("36");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [lessons, setLessons] = useState<{ title: string; description: string }[]>([]);
  const [applying, startApply] = useTransition();

  function handleOpen() {
    setOpen(true);
    setError("");
    setLessons([]);
  }

  async function handleGenerate() {
    setError("");
    setGenerating(true);
    try {
      const fd = new FormData();
      fd.set("subject", subjectName);
      fd.set("gradeLevel", gradeLevel);
      fd.set("weeks", weeks);
      const result = await generateCurriculumPlan(fd);
      if ("error" in result) {
        setError(result.error);
      } else {
        setLessons(result.lessons);
      }
    } catch {
      setError("Failed to generate curriculum plan");
    } finally {
      setGenerating(false);
    }
  }

  function handleRemoveLesson(index: number) {
    setLessons((prev) => prev.filter((_, i) => i !== index));
  }

  function handleApply() {
    if (lessons.length === 0) return;
    startApply(async () => {
      setError("");
      try {
        for (const lesson of lessons) {
          const fd = new FormData();
          fd.set("title", lesson.title);
          fd.set("description", lesson.description);
          fd.set("curriculum_id", curriculumId);
          await createLesson(fd);
        }
        setOpen(false);
        setLessons([]);
        router.refresh();
      } catch {
        setError("Failed to create some lessons");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="rounded-lg bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
      >
        AI Plan
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="AI Curriculum Plan">
        <div className="space-y-4">
          {lessons.length === 0 ? (
            <>
              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  Subject
                </label>
                <input
                  type="text"
                  value={subjectName}
                  disabled
                  className="w-full rounded-lg border bg-surface-muted px-3 py-2 text-sm text-muted"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  Grade Level
                </label>
                <select
                  value={gradeLevel}
                  onChange={(e) => setGradeLevel(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                >
                  {gradeLevels.map((level) => (
                    <option key={level} value={level}>
                      {level}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-secondary">
                  Number of Weeks
                </label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={weeks}
                  onChange={(e) => setWeeks(e.target.value)}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
                >
                  {generating ? "Generating..." : "Generate Plan"}
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-muted">
                {lessons.length} lessons generated. Remove any you don&apos;t want, then click Apply to create them.
              </p>

              <div className="max-h-80 space-y-2 overflow-y-auto">
                {lessons.map((lesson, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-light bg-surface p-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-primary">
                        {i + 1}. {lesson.title}
                      </p>
                      {lesson.description && (
                        <p className="mt-0.5 text-xs text-muted">{lesson.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveLesson(i)}
                      className="flex-shrink-0 text-xs text-red-500 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setLessons([])}
                  className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={applying || lessons.length === 0}
                  className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
                >
                  {applying ? "Creating Lessons..." : `Apply ${lessons.length} Lessons`}
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </>
  );
}
