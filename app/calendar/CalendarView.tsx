"use client";

import { useCallback, useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import LessonDetailModal from "./LessonDetailModal";
import LessonFormModal from "./LessonFormModal";

type Lesson = {
  id: string;
  title: string;
  status: string;
  planned_date: string;
  subject_name: string;
  subject_color: string;
  curriculum_name: string;
  child_name: string;
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
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [externalEvents, setExternalEvents] = useState<ExternalEvent[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayModalOpen, setDayModalOpen] = useState(false);

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

  function handleLessonClick(lessonId: string) {
    setDayModalOpen(false);
    setDetailLessonId(lessonId);
    setDetailOpen(true);
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
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-surface-muted"
          >
            &larr;
          </button>
          <span className="min-w-[140px] text-center font-semibold">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-surface-muted"
          >
            &rarr;
          </button>
        </div>
      </div>

      {fetchError && (
        <p className="mb-4 rounded-lg bg-[var(--error-bg)] p-3 text-sm text-red-600" role="alert">
          {fetchError}
        </p>
      )}

      {/* Calendar Grid */}
      <Card>
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
              className="aspect-square min-h-[110px] bg-surface-muted p-2"
            />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayLessons = lessonsByDate[dateStr] || [];
            const dayEvents = eventsByDate[dateStr] || [];
            const subjectsForDay = Array.from(
              new Map(
                dayLessons.map((l) => [l.subject_name, l.subject_color]),
              ).entries(),
            );
            const isToday =
              day === now.getDate() &&
              month === now.getMonth() + 1 &&
              year === now.getFullYear();

            return (
              <button
                key={day}
                onClick={() => {
                  setSelectedDate(dateStr);
                  setDayModalOpen(true);
                }}
                className={`aspect-square min-h-[110px] border p-2 text-left transition-colors hover:bg-interactive-light ${
                  isToday
                    ? "bg-interactive-light ring-2 ring-[var(--interactive-border)]"
                    : "bg-surface"
                }`}
              >
                <span
                  className={`text-sm ${isToday ? "font-bold text-interactive" : "text-secondary"}`}
                >
                  {day}
                </span>
                <div className="mt-1 space-y-1">
                  {dayEvents.slice(0, 1).map((event) => (
                    <div key={event.event_id} className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: event.color }}
                      />
                      <span className="max-w-[92px] truncate text-[10px] text-secondary">
                        🏫 {event.title}
                      </span>
                    </div>
                  ))}
                  {subjectsForDay.slice(0, 2).map(([subjectName, color]) => (
                    <div key={subjectName} className="flex items-center gap-1">
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="max-w-[92px] truncate text-[10px] text-tertiary">
                        {subjectName}
                      </span>
                    </div>
                  ))}
                  {dayEvents.length + subjectsForDay.length > 2 && (
                    <span className="block text-[10px] text-muted">
                      +{dayEvents.length + subjectsForDay.length - 2} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>

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
                    <div className="mb-4 space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                        External Events
                      </p>
                      {selectedEvents.map((event) => (
                        <div
                          key={`${event.event_id}-${event.date}`}
                          className="rounded-lg border border-light bg-surface-muted p-2"
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 rounded-full"
                              style={{ backgroundColor: event.color }}
                            />
                            <span className="text-sm font-medium text-secondary">
                              {event.title}
                            </span>
                          </div>
                          {event.description && (
                            <p className="mt-1 text-xs text-muted">{event.description}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {Object.entries(grouped).map(
                    ([subjectName, { color, curricula }]) => (
                      <div key={subjectName}>
                        <div className="mb-2 flex items-center gap-2">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-semibold text-secondary">
                            {subjectName}
                          </span>
                        </div>
                        {Object.entries(curricula).map(([currName, lessons]) => (
                          <div key={currName} className="ml-5 mb-2">
                            <p className="mb-1 text-xs font-medium text-muted">
                              {currName}
                            </p>
                            <div className="space-y-1">
                              {lessons.map((l) => (
                                <button
                                  key={l.id}
                                  onClick={() => handleLessonClick(l.id)}
                                  className="flex w-full items-center justify-between rounded-lg border p-2 text-left transition-colors hover:bg-surface-muted"
                                >
                                  <span className="text-sm font-medium text-primary">
                                    {l.title}
                                  </span>
                                  <Badge variant="primary">{l.child_name}</Badge>
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ),
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
