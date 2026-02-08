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

type Child = { id: string; name: string };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function CalendarView({ children }: { children: Child[] }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [selectedChild, setSelectedChild] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
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
    resources: { id: string; type: string; url: string; title: string | null }[];
  } | null>(null);

  const fetchLessons = useCallback(() => {
    const params = new URLSearchParams({ year: String(year), month: String(month) });
    if (selectedChild) params.set("childId", selectedChild);
    fetch(`/api/calendar?${params}`)
      .then((r) => r.json())
      .then((data) => setLessons(data.lessons || []));
  }, [selectedChild, year, month]);

  useEffect(() => {
    fetchLessons();
  }, [fetchLessons]);

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const lessonsByDate: Record<string, Lesson[]> = {};
  for (const l of lessons) {
    const d = l.planned_date?.split("T")[0];
    if (d) {
      if (!lessonsByDate[d]) lessonsByDate[d] = [];
      lessonsByDate[d].push(l);
    }
  }

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  }

  const selectedLessons = selectedDate ? lessonsByDate[selectedDate] || [] : [];

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
    resources: { id: string; type: string; url: string; title: string | null }[];
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
        <select
          value={selectedChild}
          onChange={(e) => setSelectedChild(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm"
        >
          <option value="">All Students</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          >
            &larr;
          </button>
          <span className="min-w-[140px] text-center font-semibold">
            {MONTHS[month - 1]} {year}
          </span>
          <button
            onClick={nextMonth}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
          >
            &rarr;
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <div className="grid grid-cols-7 gap-px">
          {DAYS.map((d) => (
            <div
              key={d}
              className="p-2 text-center text-xs font-medium text-gray-500"
            >
              {d}
            </div>
          ))}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square min-h-[110px] bg-gray-50 p-2" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayLessons = lessonsByDate[dateStr] || [];
            const subjectsForDay = Array.from(
              new Map(dayLessons.map((l) => [l.subject_name, l.subject_color])).entries()
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
                  className={`aspect-square min-h-[110px] border p-2 text-left transition-colors hover:bg-primary-50 ${
                    isToday ? "bg-primary-50 ring-2 ring-primary-300" : "bg-white"
                  }`}
                >
                <span
                  className={`text-sm ${isToday ? "font-bold text-primary-600" : "text-gray-700"}`}
                >
                  {day}
                </span>
                <div className="mt-1 space-y-1">
                  {subjectsForDay.slice(0, 2).map(([subjectName, color]) => (
                    <div key={subjectName} className="flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                      <span className="max-w-[92px] truncate text-[10px] text-gray-600">{subjectName}</span>
                    </div>
                  ))}
                  {subjectsForDay.length > 2 && (
                    <span className="block text-[10px] text-gray-400">+{subjectsForDay.length - 2} more</span>
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
        title={selectedDate ? new Date(selectedDate + "T12:00:00").toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }) : ""}
      >
        <div className="space-y-4">
          {selectedLessons.length === 0 ? (
            <p className="text-gray-400">No lessons on this day</p>
          ) : (
            (() => {
              // Group by subject, then curriculum
              const grouped: Record<string, { color: string; curricula: Record<string, Lesson[]> }> = {};
              for (const l of selectedLessons) {
                if (!grouped[l.subject_name]) grouped[l.subject_name] = { color: l.subject_color, curricula: {} };
                if (!grouped[l.subject_name].curricula[l.curriculum_name]) grouped[l.subject_name].curricula[l.curriculum_name] = [];
                grouped[l.subject_name].curricula[l.curriculum_name].push(l);
              }
              return Object.entries(grouped).map(([subjectName, { color, curricula }]) => (
                <div key={subjectName}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-sm font-semibold text-gray-700">{subjectName}</span>
                  </div>
                  {Object.entries(curricula).map(([currName, lessons]) => (
                    <div key={currName} className="ml-5 mb-2">
                      <p className="mb-1 text-xs font-medium text-gray-400">{currName}</p>
                      <div className="space-y-1">
                        {lessons.map((l) => (
                          <button
                            key={l.id}
                            onClick={() => handleLessonClick(l.id)}
                            className="flex w-full items-center justify-between rounded-lg border p-2 text-left transition-colors hover:bg-gray-50"
                          >
                            <span className="text-sm font-medium text-gray-800">{l.title}</span>
                            <Badge variant="primary">{l.child_name}</Badge>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ));
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
      />

      {/* Lesson Form Modal */}
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
    </div>
  );
}
