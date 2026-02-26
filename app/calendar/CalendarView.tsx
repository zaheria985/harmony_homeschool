"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ViewToggle from "@/components/ui/ViewToggle";
import LessonDetailModal from "@/components/lessons/LessonDetailModal";
import LessonFormModal from "./LessonFormModal";
import SemesterOverview from "@/components/calendar/SemesterOverview";
import { markLessonComplete } from "@/lib/actions/completions";
import { saveOccurrenceNote } from "@/lib/actions/external-events";
import { rescheduleLesson } from "@/lib/actions/lessons";

type Lesson = {
  id: string;
  title: string;
  status: string;
  planned_date: string;
  subject_name: string;
  subject_color: string;
  curriculum_name: string;
  child_name: string;
  child_id: string;
  grade: number | null;
  pass_fail: string | null;
};

type ExternalEvent = {
  event_id: string;
  date: string;
  title: string;
  description: string | null;
  color: string;
  start_time: string | null;
  end_time: string | null;
  all_day: boolean;
};

type OccurrenceNote = {
  id: string;
  event_id: string;
  occurrence_date: string;
  notes: string;
};

type Child = { id: string; name: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function statusBadge(status: string) {
  switch (status) {
    case "completed":
      return <Badge variant="success">Done</Badge>;
    case "in_progress":
      return <Badge variant="info">In Progress</Badge>;
    default:
      return <Badge variant="default">Planned</Badge>;
  }
}

function formatGrade(grade: number | null, passFail: string | null): string | null {
  if (passFail) return passFail === "pass" ? "Pass" : "Fail";
  if (grade !== null && grade !== undefined) return `${grade}%`;
  return null;
}

export default function CalendarView({
  children,
  forcedChildId,
  readOnly = false,
}: {
  children: Child[];
  forcedChildId?: string;
  readOnly?: boolean;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedChild, setSelectedChild] = useState("");
  const [calView, setCalView] = useState<string>("month");

  // Semester overview defaults to 6 months starting from August of the current school year
  const semesterStartYear = month >= 8 ? year : year - 1;
  const semesterStartMonth = `${semesterStartYear}-08`;
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);

  // Occurrence notes
  const [occurrenceNotes, setOccurrenceNotes] = useState<Record<string, string>>({});
  const [editingNoteFor, setEditingNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [isSavingNote, startSavingNote] = useTransition();

  // Quick complete
  const [isCompleting, startCompleting] = useTransition();
  const [completingLessonId, setCompletingLessonId] = useState<string | null>(null);

  // Lesson detail modal
  const [detailLessonId, setDetailLessonId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Lesson form modal
  const [formOpen, setFormOpen] = useState(false);
  const [formEditData, setFormEditData] = useState<{
    id: string;
    title: string;
    description: string | null;
    planned_date: string | null;
    curriculum_id: string;
    subject_id: string;
    resources: {
      id: string;
      type: string;
      url: string;
      title: string | null;
    }[];
  } | null>(null);

  // Drag-and-drop rescheduling
  const [draggedLesson, setDraggedLesson] = useState<{ id: string; date: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [isRescheduling, startRescheduling] = useTransition();

  const [fetchError, setFetchError] = useState("");

  const fetchLessons = useCallback(() => {
    const params = new URLSearchParams({
      year: String(year),
      month: String(month),
    });
    if (selectedChild) params.set("childId", selectedChild);
    setFetchError("");
    fetch(`/api/calendar?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load calendar data");
        return r.json();
      })
      .then((data) => {
        setLessons(data.lessons || []);
        setExternalEvents(data.externalEvents || []);
      })
      .catch(() => setFetchError("Failed to load calendar data. Please try again."));
  }, [selectedChild, year, month]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  useEffect(() => {
    if (forcedChildId) {
      setSelectedChild(forcedChildId);
    }
  }, [forcedChildId]);

  // Fetch occurrence notes when day modal opens
  useEffect(() => {
    if (!dayModalOpen || !selectedDate) {
      setOccurrenceNotes({});
      setEditingNoteFor(null);
      return;
    }
    const dayEvents = eventsByDate[selectedDate] || [];
    if (dayEvents.length === 0) return;

    const eventIds = dayEvents.map((e) => e.event_id).join(",");
    fetch(`/api/calendar/occurrence-notes?date=${selectedDate}&eventIds=${eventIds}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const note of (data.notes || []) as OccurrenceNote[]) {
          map[note.event_id] = note.notes;
        }
        setOccurrenceNotes(map);
      })
      .catch(() => {
        // Silently fail — notes are non-critical
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayModalOpen, selectedDate]);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const lessonsByDate: Record<string, Lesson[]> = {};
  const eventsByDate: Record<string, ExternalEvent[]> = {};
  for (const l of lessons) {
    const d = l.planned_date?.split("T")[0];
    if (d) {
      if (!lessonsByDate[d]) lessonsByDate[d] = [];
      lessonsByDate[d].push(l);
    }
  }
  for (const event of externalEvents) {
    if (!eventsByDate[event.date]) eventsByDate[event.date] = [];
    eventsByDate[event.date].push(event);
  }

  function prevMonth() {
    if (month === 1) {
      setMonth(12);
      setYear(year - 1);
    } else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) {
      setMonth(1);
      setYear(year + 1);
    } else setMonth(month + 1);
  }

  const selectedLessons = selectedDate ? lessonsByDate[selectedDate] || [] : [];
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  // Summary stats
  const completedCount = selectedLessons.filter((l) => l.status === "completed").length;
  const totalLessons = selectedLessons.length;
  const totalEvents = selectedEvents.length;

  function handleLessonClick(lessonId: string) {
    setDayModalOpen(false);
    setDetailLessonId(lessonId);
    setDetailOpen(true);
  }

  function handleQuickComplete(lessonId: string, childId: string) {
    setCompletingLessonId(lessonId);
    startCompleting(async () => {
      const formData = new FormData();
      formData.set("lessonId", lessonId);
      formData.set("childId", childId);
      await markLessonComplete(formData);
      fetchLessons();
      setCompletingLessonId(null);
    });
  }

  function handleStartEditNote(eventId: string) {
    setEditingNoteFor(eventId);
    setNoteText(occurrenceNotes[eventId] || "");
  }

  function handleSaveNote(eventId: string) {
    if (!selectedDate) return;
    startSavingNote(async () => {
      const formData = new FormData();
      formData.set("eventId", eventId);
      formData.set("occurrenceDate", selectedDate);
      formData.set("notes", noteText);
      await saveOccurrenceNote(formData);
      if (noteText.trim()) {
        setOccurrenceNotes((prev) => ({ ...prev, [eventId]: noteText.trim() }));
      } else {
        setOccurrenceNotes((prev) => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }
      setEditingNoteFor(null);
    });
  }

  function handleEditLesson(lesson: {
    id: string;
    title: string;
    description: string | null;
    planned_date: string | null;
    curriculum_id: string;
    subject_id: string;
    resources: {
      id: string;
      type: string;
      url: string;
      title: string | null;
    }[];
  }) {
    setDetailOpen(false);
    setFormEditData(lesson);
    setFormOpen(true);
  }

  function handleLessonChanged() {
    fetchLessons();
  }

  return (
    <div>
      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-center gap-4">
        {forcedChildId ? (
          <div className="rounded-lg border border-border px-3 py-2 text-sm text-tertiary">
            {children.find((c) => c.id === forcedChildId)?.name || "Student"}
          </div>
        ) : (
          <select
            value={selectedChild}
            onChange={(e) => setSelectedChild(e.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
          >
            <option value="">All Students</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
        <ViewToggle
          storageKey="calendar-view"
          options={[
            { key: "month", label: "Month" },
            { key: "semester", label: "Semester" },
          ]}
          defaultView="month"
          onChange={setCalView}
        />
        {calView === "month" && (
          <div className="flex items-center gap-2">
            <button
              onClick={prevMonth}
              aria-label="Previous month"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-surface-muted"
            >
              &larr;
            </button>
            <span className="min-w-[140px] text-center font-semibold">
              {MONTHS[month - 1]} {year}
            </span>
            <button
              onClick={nextMonth}
              aria-label="Next month"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-surface-muted"
            >
              &rarr;
            </button>
          </div>
        )}
      </div>

      {calView === "semester" && (
        <SemesterOverview
          startMonth={semesterStartMonth}
          months={6}
          childId={selectedChild || undefined}
        />
      )}

      {calView === "month" && fetchError && (
        <p className="mb-4 rounded-lg bg-[var(--error-bg)] p-3 text-sm text-red-600" role="alert">
          {fetchError}
        </p>
      )}

      {/* Rescheduling indicator */}
      {isRescheduling && (
        <div className="mb-2 flex items-center gap-2 rounded-lg bg-interactive/10 px-3 py-2 text-sm text-interactive">
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-interactive border-t-transparent" />
          Rescheduling lesson...
        </div>
      )}

      {/* Calendar Grid */}
      {calView === "month" && <Card>
        <div className="grid grid-cols-7 gap-px">
          {DAYS.map((d) => (
            <div
              key={d}
              className="p-2 text-center text-xs font-medium text-muted"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="min-h-[90px] bg-surface-muted p-1.5"
            />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayLessons = lessonsByDate[dateStr] || [];
            const dayEvents = eventsByDate[dateStr] || [];
            const dayCompleted = dayLessons.filter((l) => l.status === "completed").length;
            const dayTotal = dayLessons.length;
            const isToday =
              day === now.getDate() &&
              month === now.getMonth() + 1 &&
              year === now.getFullYear();
            const isDropTarget = dropTarget === dateStr && draggedLesson?.date !== dateStr;

            return (
              <div
                key={day}
                onClick={() => {
                  if (!draggedLesson) {
                    setSelectedDate(dateStr);
                    setDayModalOpen(true);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTarget(dateStr);
                }}
                onDragLeave={(e) => {
                  // Only clear if leaving the cell entirely (not entering a child)
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const lessonId = e.dataTransfer.getData("text/plain");
                  const fromDate = draggedLesson?.date;
                  setDropTarget(null);
                  setDraggedLesson(null);
                  if (lessonId && fromDate && fromDate !== dateStr) {
                    startRescheduling(async () => {
                      await rescheduleLesson(lessonId, dateStr);
                      fetchLessons();
                    });
                  }
                }}
                className={`min-h-[90px] cursor-pointer border p-1.5 text-left transition-colors hover:bg-interactive-light ${
                  isToday
                    ? "bg-interactive-light ring-2 ring-[var(--interactive-border)]"
                    : "bg-surface"
                } ${
                  isDropTarget
                    ? "ring-2 ring-dashed ring-interactive bg-interactive/10"
                    : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-sm ${isToday ? "font-bold text-interactive" : "text-secondary"}`}
                  >
                    {day}
                  </span>
                  {dayTotal > 0 && (
                    <span className={`text-[10px] font-medium ${
                      dayCompleted === dayTotal ? "text-[var(--success-text)]" : "text-muted"
                    }`}>
                      {dayCompleted}/{dayTotal}
                    </span>
                  )}
                </div>
                <div className="mt-0.5 space-y-px overflow-hidden">
                  {dayEvents.slice(0, 2).map((event) => (
                    <div key={event.event_id} className="flex items-center gap-0.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />
                      <span className="truncate text-[10px] leading-tight text-secondary">
                        {event.title}
                      </span>
                    </div>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="text-[9px] text-muted">+{dayEvents.length - 2} more</span>
                  )}
                  {dayLessons.slice(0, 3).map((l) => {
                    const isDraggable = !readOnly && l.status !== "completed";
                    const isBeingDragged = draggedLesson?.id === l.id;
                    return (
                      <div
                        key={l.id}
                        draggable={isDraggable}
                        onDragStart={(e) => {
                          if (!isDraggable) return;
                          e.dataTransfer.setData("text/plain", l.id);
                          e.dataTransfer.effectAllowed = "move";
                          setDraggedLesson({ id: l.id, date: dateStr });
                        }}
                        onDragEnd={() => {
                          setDraggedLesson(null);
                          setDropTarget(null);
                        }}
                        className={`flex items-center gap-0.5 ${
                          isDraggable ? "cursor-grab active:cursor-grabbing" : ""
                        } ${isBeingDragged ? "opacity-50 ring-1 ring-interactive rounded" : ""}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            l.status === "completed" ? "ring-1 ring-[var(--success-text)]" : ""
                          }`}
                          style={{ backgroundColor: l.subject_color }}
                        />
                        <span className={`truncate text-[10px] leading-tight ${
                          l.status === "completed" ? "text-muted line-through" : "text-tertiary"
                        }`}>
                          {l.title}
                        </span>
                      </div>
                    );
                  })}
                  {dayLessons.length > 3 && (
                    <span className="text-[9px] text-muted">+{dayLessons.length - 3} more</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>}

      {/* Day Detail Modal */}
      <Modal
        open={dayModalOpen}
        onClose={() => setDayModalOpen(false)}
        title={
          selectedDate
            ? new Date(selectedDate + "T12:00:00").toLocaleDateString(
                undefined,
                { weekday: "long", month: "long", day: "numeric" },
              )
            : ""
        }
      >
        <div className="space-y-4">
          {/* Summary stats */}
          {(totalLessons > 0 || totalEvents > 0) && (
            <div className="flex items-center gap-3 rounded-lg bg-surface-muted px-3 py-2">
              {totalLessons > 0 && (
                <span className="text-xs text-secondary">
                  <span className="font-semibold">{totalLessons}</span> lesson{totalLessons !== 1 ? "s" : ""}
                  {completedCount > 0 && (
                    <span className="text-[var(--success-text)]"> ({completedCount} done)</span>
                  )}
                </span>
              )}
              {totalLessons > 0 && totalEvents > 0 && (
                <span className="text-muted">|</span>
              )}
              {totalEvents > 0 && (
                <span className="text-xs text-secondary">
                  <span className="font-semibold">{totalEvents}</span> event{totalEvents !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {selectedLessons.length === 0 && selectedEvents.length === 0 ? (
            <p className="text-muted">No lessons or events on this day</p>
          ) : (
            (() => {
              const hasEvents = selectedEvents.length > 0;
              // Group by subject, then curriculum
              const grouped: Record<
                string,
                { color: string; curricula: Record<string, Lesson[]> }
              > = {};
              for (const l of selectedLessons) {
                if (!grouped[l.subject_name])
                  grouped[l.subject_name] = {
                    color: l.subject_color,
                    curricula: {},
                  };
                if (!grouped[l.subject_name].curricula[l.curriculum_name])
                  grouped[l.subject_name].curricula[l.curriculum_name] = [];
                grouped[l.subject_name].curricula[l.curriculum_name].push(l);
              }
              return (
                <>
                  {hasEvents && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        Events
                      </p>
                      {selectedEvents.map((event) => (
                        <div
                          key={`${event.event_id}-${event.date}`}
                          className="rounded-lg border border-light bg-surface-muted p-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: event.color }}
                              />
                              <span className="text-sm font-medium text-secondary">
                                {event.title}
                              </span>
                              {!event.all_day && event.start_time && (
                                <span className="text-[10px] text-muted">
                                  {event.start_time.slice(0, 5)}
                                  {event.end_time ? `\u2013${event.end_time.slice(0, 5)}` : ""}
                                </span>
                              )}
                            </div>
                            {!readOnly && (
                              <button
                                onClick={() => handleStartEditNote(event.event_id)}
                                className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium text-interactive hover:bg-interactive-light"
                              >
                                {occurrenceNotes[event.event_id] ? "Edit note" : "Add note"}
                              </button>
                            )}
                          </div>
                          {event.description && (
                            <p className="mt-1 ml-[18px] text-xs text-muted">{event.description}</p>
                          )}
                          {/* Show existing note */}
                          {occurrenceNotes[event.event_id] && editingNoteFor !== event.event_id && (
                            <p className="mt-1.5 ml-[18px] rounded bg-surface px-2 py-1 text-xs text-secondary italic">
                              {occurrenceNotes[event.event_id]}
                            </p>
                          )}
                          {/* Inline note editor */}
                          {editingNoteFor === event.event_id && (
                            <div className="mt-2 ml-[18px] space-y-1.5">
                              <textarea
                                value={noteText}
                                onChange={(e) => setNoteText(e.target.value)}
                                placeholder="Add a note for this occurrence..."
                                rows={2}
                                className="w-full rounded border border-border bg-surface px-2 py-1 text-xs text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-focus"
                                autoFocus
                              />
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => handleSaveNote(event.event_id)}
                                  disabled={isSavingNote}
                                  className="rounded bg-interactive px-2 py-0.5 text-[10px] font-medium text-white hover:opacity-90 disabled:opacity-50"
                                >
                                  {isSavingNote ? "Saving..." : "Save"}
                                </button>
                                <button
                                  onClick={() => setEditingNoteFor(null)}
                                  className="rounded px-2 py-0.5 text-[10px] text-muted hover:text-secondary"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {Object.entries(grouped).length > 0 && (
                    <div className="space-y-3">
                      {hasEvents && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                          Lessons
                        </p>
                      )}
                      {Object.entries(grouped).map(
                        ([subjectName, { color, curricula }]) => (
                          <div key={subjectName}>
                            <div className="mb-1.5 flex items-center gap-2">
                              <span
                                className="h-3 w-3 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                              />
                              <span className="text-sm font-semibold text-secondary">
                                {subjectName}
                              </span>
                            </div>
                            {Object.entries(curricula).map(([currName, currLessons]) => (
                              <div key={currName} className="ml-5 mb-2">
                                <p className="mb-1 text-xs font-medium text-muted">
                                  {currName}
                                </p>
                                <div className="space-y-1">
                                  {currLessons.map((l) => {
                                    const gradeStr = formatGrade(l.grade, l.pass_fail);
                                    const isThisCompleting = completingLessonId === l.id && isCompleting;
                                    return (
                                      <div
                                        key={l.id}
                                        className="flex w-full items-center gap-2 rounded-lg border p-2 transition-colors hover:bg-surface-muted"
                                      >
                                        {/* Quick complete checkbox */}
                                        {!readOnly && l.status !== "completed" && (
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleQuickComplete(l.id, l.child_id);
                                            }}
                                            disabled={isThisCompleting}
                                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border text-transparent hover:border-[var(--success-text)] hover:text-[var(--success-text)] disabled:opacity-50"
                                            aria-label="Quick complete"
                                            title="Mark complete"
                                          >
                                            {isThisCompleting ? (
                                              <span className="h-2 w-2 animate-pulse rounded-full bg-muted" />
                                            ) : (
                                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                              </svg>
                                            )}
                                          </button>
                                        )}
                                        {l.status === "completed" && (
                                          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-[var(--success-bg)] text-[var(--success-text)]">
                                            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                          </span>
                                        )}
                                        <button
                                          onClick={() => handleLessonClick(l.id)}
                                          className="flex min-w-0 flex-1 items-center justify-between gap-2 text-left"
                                        >
                                          <span className={`truncate text-sm font-medium ${
                                            l.status === "completed" ? "text-muted line-through" : "text-primary"
                                          }`}>
                                            {l.title}
                                          </span>
                                          <div className="flex shrink-0 items-center gap-1.5">
                                            {gradeStr && (
                                              <span className="text-[10px] font-semibold text-[var(--success-text)]">
                                                {gradeStr}
                                              </span>
                                            )}
                                            {statusBadge(l.status)}
                                            <Badge variant="primary">{l.child_name}</Badge>
                                          </div>
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </>
              );
            })()
          )}
        </div>
      </Modal>

      {/* Lesson Detail Modal */}
      <LessonDetailModal
        lessonId={detailLessonId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={handleEditLesson}
        onChanged={handleLessonChanged}
        readOnly={readOnly}
      />

      {/* Lesson Form Modal */}
      {!readOnly && (
        <LessonFormModal
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setFormEditData(null);
          }}
          childId={selectedChild}
          defaultDate={selectedDate || undefined}
          editData={formEditData || undefined}
          onSaved={handleLessonChanged}
        />
      )}
    </div>
  );
}
