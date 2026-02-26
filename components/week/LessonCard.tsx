"use client";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import LessonCheckbox from "./LessonCheckbox";
import RescheduleButton from "./RescheduleButton";
import ResourceEmbed from "./ResourceEmbed";
import type { DaySubjectLesson } from "@/lib/queries/week";
export default function LessonCard({ lesson, onLessonClick }: { lesson: DaySubjectLesson; onLessonClick?: (id: string) => void }) {
  const effectiveStatus = lesson.effective_status || lesson.status;
  const isCompleted = effectiveStatus === "completed";
  return (
    <div
      className={`rounded-2xl border p-4 ${isCompleted ? "border-success-200 bg-[var(--success-bg)]/30 dark:border-success-900/40/20" : "border-light bg-surface-slate"}`}
    >
      {" "}
      <div className="flex items-start gap-3">
        {" "}
        <div className="mt-0.5">
          {" "}
          <LessonCheckbox
            lessonId={lesson.id}
            childId={lesson.child_id}
            isCompleted={isCompleted}
          />{" "}
        </div>{" "}
        <div className="min-w-0 flex-1">
          {" "}
          <div className="flex items-center gap-2">
            {" "}
            {onLessonClick ? (
              <button
                type="button"
                onClick={() => onLessonClick(lesson.id)}
                className={`font-medium hover:underline text-left ${isCompleted ? "text-muted line-through" : "text-interactive"}`}
              >
                {lesson.title}
              </button>
            ) : (
              <Link
                href={`/lessons/${lesson.id}`}
                className={`font-medium hover:underline ${isCompleted ? "text-muted line-through" : "text-interactive"}`}
              >
                {lesson.title}
              </Link>
            )}{" "}
            {lesson.is_recurring && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" title={`Repeats ${lesson.recurrence_rule || "weekly"}`}>
                ↻ {lesson.recurrence_rule || "weekly"}
              </span>
            )}{" "}
            {isCompleted && <Badge variant="success">Done</Badge>}{" "}
            {effectiveStatus === "in_progress" && (
              <Badge variant="warning">In Progress</Badge>
            )}{" "}
          </div>{" "}
          {lesson.curriculum_name && (
            <p className="mt-0.5 text-xs">
              {" "}
              <Link
                href={`/curricula/${lesson.curriculum_id}`}
                className="text-muted hover:text-interactive hover:underline"
              >
                {" "}
                {lesson.curriculum_name}{" "}
              </Link>{" "}
            </p>
          )}{" "}
          {lesson.description && (
            <p className="mt-1.5 text-sm text-tertiary">{lesson.description}</p>
          )}{" "}
          {lesson.grade !== null && (
            <p className="mt-1 text-sm text-muted">
              {" "}
              Grade: <span className="font-medium">{lesson.grade}%</span>{" "}
            </p>
          )}{" "}
          {lesson.completion_notes && (
            <p className="mt-1 text-sm italic text-muted">
              {lesson.completion_notes}
            </p>
          )}{" "}
          {lesson.resources.length > 0 && (
            <div className="mt-3 space-y-2">
              {" "}
              {lesson.resources.map((resource) => (
                <ResourceEmbed key={resource.id} resource={resource} />
              ))}{" "}
            </div>
          )}{" "}
          {!isCompleted && (
            <div className="mt-2">
              {" "}
              <RescheduleButton
                lessonId={lesson.id}
                currentDate={lesson.planned_date}
              />{" "}
            </div>
          )}{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
