"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
interface ModalLesson {
  id: string;
  title: string;
  status: string;
  curriculum_name: string;
  grade: number | null;
}
interface ModalSubject {
  subjectName: string;
  subjectColor: string | null;
  lessons: ModalLesson[];
}
export default function DayModal({
  open,
  onClose,
  title,
  subjects,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subjects: ModalSubject[];
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      className="w-[90vw] max-w-5xl rounded-xl border-0 p-0 shadow-xl backdrop:bg-[var(--overlay)]"
    >
      {" "}
      <div className="bg-surface-slate p-6">
        {" "}
        <div className="mb-5 flex items-center justify-between">
          {" "}
          <h2 className="text-lg font-semibold text-primary">{title}</h2>{" "}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-surface-subtle hover:text-tertiary dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            {" "}
            ✕{" "}
          </button>{" "}
        </div>{" "}
        {subjects.length === 0 ? (
          <p className="py-8 text-center text-gray-400 dark:text-slate-500">
            No lessons scheduled for this day.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {" "}
            {subjects.map((subject) => (
              <div
                key={subject.subjectName}
                className="rounded-lg border border-light bg-surface-slate"
              >
                {" "}
                <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                  {" "}
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: subject.subjectColor || "#6366f1",
                    }}
                  />{" "}
                  <h3 className="text-sm font-semibold text-primary">
                    {" "}
                    {subject.subjectName}{" "}
                  </h3>{" "}
                  <span className="ml-auto text-xs text-gray-400 dark:text-slate-500">
                    {" "}
                    {
                      subject.lessons.filter((l) => l.status === "completed")
                        .length
                    }
                    / {subject.lessons.length}{" "}
                  </span>{" "}
                </div>{" "}
                <div className="divide-y divide-gray-50 px-4 py-2 dark:divide-slate-800">
                  {" "}
                  {subject.lessons.map((lesson) => {
                    const isCompleted = lesson.status === "completed";
                    return (
                      <Link
                        key={lesson.id}
                        href={`/lessons/${lesson.id}`}
                        className="flex items-center gap-2 py-2.5 transition-colors hover:text-interactive dark:hover:text-primary-300"
                        onClick={onClose}
                      >
                        {" "}
                        <span
                          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isCompleted ? "bg-[var(--success-solid)]" : lesson.status === "in_progress" ? "bg-[var(--warning-solid)]" : "bg-gray-300"}`}
                        />{" "}
                        <span
                          className={`flex-1 text-sm ${isCompleted ? "text-gray-400 line-through dark:text-slate-500" : "text-secondary"}`}
                        >
                          {" "}
                          {lesson.title}{" "}
                        </span>{" "}
                        {lesson.grade !== null && (
                          <span className="text-xs font-medium text-gray-400 dark:text-slate-500">
                            {" "}
                            {lesson.grade}%{" "}
                          </span>
                        )}{" "}
                      </Link>
                    );
                  })}{" "}
                </div>{" "}
              </div>
            ))}{" "}
          </div>
        )}{" "}
      </div>{" "}
    </dialog>
  );
}
