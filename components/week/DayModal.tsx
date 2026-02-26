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
interface ModalExternalEvent {
  event_id: string;
  title: string;
  color: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
}

function formatTimeRange(startTime: string | null, endTime: string | null, allDay: boolean) {
  if (allDay) return "All day";
  if (!startTime && !endTime) return "";
  const format = (time: string) => {
    const [hourRaw, minute] = time.split(":");
    const hour = Number(hourRaw);
    const suffix = hour >= 12 ? "PM" : "AM";
    const hour12 = hour % 12 || 12;
    return `${hour12}:${minute} ${suffix}`;
  };
  if (startTime && endTime) return `${format(startTime)} – ${format(endTime)}`;
  if (startTime) return `Starts ${format(startTime)}`;
  return `Until ${format(endTime as string)}`;
}

export default function DayModal({
  open,
  onClose,
  title,
  subjects,
  externalEvents = [],
  onLessonClick,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subjects: ModalSubject[];
  externalEvents?: ModalExternalEvent[];
  onLessonClick?: (id: string) => void;
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
            className="rounded-lg p-1.5 text-muted hover:bg-surface-subtle hover:text-primary"
          >
            {" "}
            ✕{" "}
          </button>{" "}
        </div>{" "}
        {externalEvents.length > 0 && (
          <div className="mb-4 space-y-2">
            {externalEvents.map((event) => (
              <div
                key={event.event_id}
                className="flex items-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted px-3 py-2"
              >
                <span className="text-sm">🏫</span>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: event.color }} />
                <span className="text-sm font-medium text-secondary">{event.title}</span>
                {formatTimeRange(event.start_time, event.end_time, event.all_day) && (
                  <span className="ml-auto text-xs text-muted">
                    {formatTimeRange(event.start_time, event.end_time, event.all_day)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {subjects.length === 0 && externalEvents.length === 0 ? (
          <p className="py-8 text-center text-muted">
            No lessons scheduled for this day.
          </p>
        ) : subjects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {" "}
            {subjects.map((subject) => (
              <div
                key={subject.subjectName}
                className="rounded-lg border border-light bg-surface-slate"
              >
                {" "}
                <div className="flex items-center gap-2 border-b border-light px-4 py-3">
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
                  <span className="ml-auto text-xs text-muted">
                    {" "}
                    {
                      subject.lessons.filter((l) => l.status === "completed")
                        .length
                    }
                    / {subject.lessons.length}{" "}
                  </span>{" "}
                </div>{" "}
                <div className="divide-y divide-border px-4 py-2">
                  {" "}
                  {subject.lessons.map((lesson) => {
                    const isCompleted = lesson.status === "completed";
                    const className = "flex w-full items-center gap-2 py-2.5 text-left transition-colors hover:text-interactive";
                    const content = (
                      <>
                        <span
                          className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${isCompleted ? "bg-[var(--success-solid)]" : lesson.status === "in_progress" ? "bg-[var(--warning-solid)]" : "bg-border"}`}
                        />
                        <span
                          className={`flex-1 text-sm ${isCompleted ? "text-muted line-through" : "text-secondary"}`}
                        >
                          {lesson.title}
                        </span>
                        {lesson.grade !== null && (
                          <span className="text-xs font-medium text-muted">
                            {lesson.grade}%
                          </span>
                        )}
                      </>
                    );
                    return onLessonClick ? (
                      <button
                        key={lesson.id}
                        type="button"
                        className={className}
                        onClick={() => onLessonClick(lesson.id)}
                      >
                        {content}
                      </button>
                    ) : (
                      <Link
                        key={lesson.id}
                        href={`/lessons/${lesson.id}`}
                        className={className}
                        onClick={onClose}
                      >
                        {content}
                      </Link>
                    );
                  })}{" "}
                </div>{" "}
              </div>
            ))}{" "}
          </div>
        ) : null}{" "}
      </div>{" "}
    </dialog>
  );
}
