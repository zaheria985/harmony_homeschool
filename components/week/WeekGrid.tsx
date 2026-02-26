"use client";
import {
  type TouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DayModal from "./DayModal";
import LessonDetailModal from "@/components/lessons/LessonDetailModal";
import {
  formatWeekdayShort,
  formatShortDate,
  isToday,
} from "@/lib/utils/dates";
import { rescheduleLesson } from "@/lib/actions/lessons";
import { saveWeeklyNote } from "@/lib/actions/weekly-notes";
import { parseChecklist, checklistProgress } from "@/components/lessons/InteractiveChecklist";
interface GridLesson {
  id: string;
  title: string;
  description: string | null;
  status: string;
  curriculum_id: string;
  curriculum_name: string;
  grade: number | null;
  checklist_state: Record<string, boolean> | null;
}
interface GridSubject {
  subjectName: string;
  subjectColor: string | null;
  lessons: GridLesson[];
}
interface DayData {
  date: string;
  subjects: GridSubject[];
  externalEvents?: {
    event_id: string;
    date: string;
    title: string;
    description: string | null;
    color: string;
    start_time: string | null;
    end_time: string | null;
    all_day: boolean;
    children: { id: string; name: string }[];
  }[];
}
interface WeekData {
  weekStart: string;
  label: string;
  days: DayData[];
}
interface DragLesson {
  id: string;
  fromDate: string;
  subjectName: string;
  subjectColor: string | null;
}
function groupByCourse(lessons: GridLesson[]) {
  const groups = new Map<string, { curriculum_id: string; lessons: GridLesson[] }>();
  for (const lesson of lessons) {
    const key = lesson.curriculum_name || "Uncategorized";
    let group = groups.get(key);
    if (!group) {
      group = { curriculum_id: lesson.curriculum_id, lessons: [] };
      groups.set(key, group);
    }
    group.lessons.push(lesson);
  }
  return Array.from(groups.entries());
}
function moveLesson(
  weeks: WeekData[],
  dragLesson: DragLesson,
  toDate: string,
): WeekData[] {
  if (dragLesson.fromDate === toDate) return weeks;
  let movedLesson: GridLesson | null = null;
  const nextWeeks = weeks.map((week) => ({
    ...week,
    days: week.days.map((day) => {
      if (day.date !== dragLesson.fromDate) return day;
      const nextSubjects = day.subjects
        .map((subject) => {
          if (subject.subjectName !== dragLesson.subjectName) return subject;
          const lessonToMove = subject.lessons.find(
            (lesson) => lesson.id === dragLesson.id,
          );
          if (!lessonToMove) return subject;
          movedLesson = lessonToMove;
          return {
            ...subject,
            lessons: subject.lessons.filter(
              (lesson) => lesson.id !== dragLesson.id,
            ),
          };
        })
        .filter((subject) => subject.lessons.length > 0);
      return { ...day, subjects: nextSubjects };
    }),
  }));
  if (!movedLesson) return weeks;
  const lessonToInsert = movedLesson;
  return nextWeeks.map((week) => ({
    ...week,
    days: week.days.map((day) => {
      if (day.date !== toDate) return day;
      const subjectIndex = day.subjects.findIndex(
        (subject) => subject.subjectName === dragLesson.subjectName,
      );
      if (subjectIndex === -1) {
        return {
          ...day,
          subjects: [
            ...day.subjects,
            {
              subjectName: dragLesson.subjectName,
              subjectColor: dragLesson.subjectColor,
              lessons: [lessonToInsert],
            },
          ],
        };
      }
      return {
        ...day,
        subjects: day.subjects.map((subject, index) =>
          index === subjectIndex
            ? { ...subject, lessons: [...subject.lessons, lessonToInsert] }
            : subject,
        ),
      };
    }),
  }));
}
export default function WeekGrid({
  weeks,
  bumpedCount = 0,
  weeklyNotes = {},
}: {
  weeks: WeekData[];
  bumpedCount?: number;
  weeklyNotes?: Record<string, string>;
}) {
  const router = useRouter();
  const [selectedDay, setSelectedDay] = useState<DayData | null>(null);
  const [detailLessonId, setDetailLessonId] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [localWeeks, setLocalWeeks] = useState<WeekData[]>(weeks);
  const [draggingLesson, setDraggingLesson] = useState<DragLesson | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [touchDragging, setTouchDragging] = useState(false);
  const [isPending, startTransition] = useTransition();
  const suppressNextClick = useRef(false);
  const longPressTimerRef = useRef<number | null>(null);
  const [subjectFilter, setSubjectFilter] = useState("");
  const [courseFilter, setCourseFilter] = useState("");
  const [localNotes, setLocalNotes] = useState<Record<string, string>>(weeklyNotes);
  const [editingNoteWeek, setEditingNoteWeek] = useState<string | null>(null);
  const [savingNote, setSavingNote] = useState(false);
  useEffect(() => {
    setLocalWeeks(weeks);
  }, [weeks]);
  const allSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const week of localWeeks)
      for (const day of week.days)
        for (const subject of day.subjects)
          set.add(subject.subjectName);
    return Array.from(set).sort();
  }, [localWeeks]);

  const allCourses = useMemo(() => {
    const map = new Map<string, string>();
    for (const week of localWeeks)
      for (const day of week.days)
        for (const subject of day.subjects) {
          if (subjectFilter && subject.subjectName !== subjectFilter) continue;
          for (const lesson of subject.lessons)
            map.set(lesson.curriculum_id, lesson.curriculum_name);
        }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [localWeeks, subjectFilter]);

  const displayWeeks = useMemo(() => {
    if (!subjectFilter && !courseFilter) return localWeeks;
    return localWeeks.map(week => ({
      ...week,
      days: week.days.map(day => ({
        ...day,
        subjects: day.subjects
          .filter(s => !subjectFilter || s.subjectName === subjectFilter)
          .map(s => ({
            ...s,
            lessons: courseFilter ? s.lessons.filter(l => l.curriculum_id === courseFilter) : s.lessons,
          }))
          .filter(s => s.lessons.length > 0),
      })),
    }));
  }, [localWeeks, subjectFilter, courseFilter]);

  const dayStats = useMemo(() => {
    const stats = new Map<
      string,
      { totalLessons: number; completedLessons: number }
    >();
    for (const week of displayWeeks) {
      for (const day of week.days) {
        let totalLessons = 0;
        let completedLessons = 0;
        for (const subject of day.subjects) {
          totalLessons += subject.lessons.length;
          for (const lesson of subject.lessons) {
            if (lesson.status === "completed") completedLessons += 1;
          }
        }
        stats.set(day.date, { totalLessons, completedLessons });
      }
    }
    return stats;
  }, [displayWeeks]);
  function handleDayClick(day: DayData, totalLessons: number) {
    if (suppressNextClick.current) {
      suppressNextClick.current = false;
      return;
    }
    if (totalLessons > 0) {
      setSelectedDay(day);
    }
  }
  function formatTimeRange(
    startTime: string | null,
    endTime: string | null,
    allDay: boolean,
  ) {
    if (allDay) return "All day";
    if (!startTime && !endTime) return "";
    const format = (time: string) => {
      const [hourRaw, minute] = time.split(":");
      const hour = Number(hourRaw);
      const suffix = hour >= 12 ? "PM" : "AM";
      const hour12 = hour % 12 || 12;
      return `${hour12}:${minute} ${suffix}`;
    };
    if (startTime && endTime)
      return `${format(startTime)} - ${format(endTime)}`;
    if (startTime) return `Starts ${format(startTime)}`;
    return `Until ${format(endTime as string)}`;
  }
  function handleDrop(targetDate: string) {
    if (
      !draggingLesson ||
      isPending ||
      draggingLesson.fromDate === targetDate
    ) {
      setDropTargetDate(null);
      return;
    }
    suppressNextClick.current = true;
    const previousWeeks = localWeeks;
    setLocalWeeks((currentWeeks) =>
      moveLesson(currentWeeks, draggingLesson, targetDate),
    );
    setDropTargetDate(null);
    setDraggingLesson(null);
    startTransition(async () => {
      const result = await rescheduleLesson(draggingLesson.id, targetDate);
      if (result && "error" in result) {
        setLocalWeeks(previousWeeks);
      }
      router.refresh();
    });
  }
  function clearLongPressTimer() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }
  function handleTouchStart(
    event: TouchEvent<HTMLElement>,
    lesson: DragLesson,
  ) {
    if (isPending || event.touches.length !== 1) return;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      suppressNextClick.current = true;
      setDraggingLesson(lesson);
      setTouchDragging(true);
    }, 220);
  }
  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    if (!touchDragging || !draggingLesson) return;
    const touch = event.touches[0];
    if (!touch) return;
    event.preventDefault();
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const dayElement =
      target instanceof HTMLElement ? target.closest("[data-day-date]") : null;
    const dayDate =
      dayElement instanceof HTMLElement
        ? dayElement.dataset.dayDate
        : undefined;
    if (dayDate && dayDate !== draggingLesson.fromDate) {
      setDropTargetDate(dayDate);
      return;
    }
    setDropTargetDate(null);
  }
  function handleTouchEnd() {
    clearLongPressTimer();
    if (!touchDragging) return;
    setTouchDragging(false);
    if (dropTargetDate) {
      handleDrop(dropTargetDate);
      return;
    }
    setDraggingLesson(null);
    setDropTargetDate(null);
  }
  function handleTouchCancel() {
    clearLongPressTimer();
    if (!touchDragging) return;
    setTouchDragging(false);
    setDraggingLesson(null);
    setDropTargetDate(null);
  }
  return (
    <>
      {" "}
      {bumpedCount > 0 && (
        <div className="mb-4 rounded-lg border border-[var(--warning-border)] bg-[var(--warning-bg)] px-3 py-2 text-sm text-[var(--warning-text)] dark:border-amber-800/60/20 dark:text-amber-300">
          {" "}
          Auto-rescheduled {bumpedCount} overdue lesson
          {bumpedCount === 1 ? "" : "s"} to upcoming school days.{" "}
        </div>
      )}{" "}
      {(allSubjects.length > 1 || allCourses.length > 1) && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <select value={subjectFilter}
            onChange={(e) => { setSubjectFilter(e.target.value); setCourseFilter(""); }}
            className="rounded-lg border border-light bg-surface px-3 py-2 text-sm">
            <option value="">All Subjects</option>
            {allSubjects.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
          <select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}
            className="rounded-lg border border-light bg-surface px-3 py-2 text-sm">
            <option value="">All Courses</option>
            {allCourses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
          {(subjectFilter || courseFilter) && (
            <button type="button" onClick={() => { setSubjectFilter(""); setCourseFilter(""); }}
              className="text-xs font-medium text-interactive hover:underline">
              Clear filters
            </button>
          )}
        </div>
      )}
      <div className="space-y-6">
        {" "}
        {displayWeeks.map((week) => (
          <div key={week.weekStart}>
            {" "}
            <div className="mb-2 flex items-center gap-2">
              <h3 className="text-sm font-semibold text-tertiary">
                {week.label}
              </h3>
              <button
                type="button"
                onClick={() => setEditingNoteWeek(editingNoteWeek === week.weekStart ? null : week.weekStart)}
                className="text-xs text-muted hover:text-interactive"
              >
                {localNotes[week.weekStart] ? "📝" : "＋ note"}
              </button>
            </div>
            {editingNoteWeek === week.weekStart && (
              <div className="mb-3 rounded-lg border border-light bg-surface p-2">
                <textarea
                  value={localNotes[week.weekStart] || ""}
                  onChange={(e) => setLocalNotes((prev) => ({ ...prev, [week.weekStart]: e.target.value }))}
                  placeholder="Week reflections, plans, notes..."
                  rows={2}
                  className="w-full rounded border border-light bg-surface px-2 py-1 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-focus"
                />
                <div className="mt-1 flex gap-2">
                  <button
                    type="button"
                    disabled={savingNote}
                    onClick={async () => {
                      setSavingNote(true);
                      await saveWeeklyNote(week.weekStart, localNotes[week.weekStart] || "");
                      setSavingNote(false);
                      setEditingNoteWeek(null);
                    }}
                    className="rounded bg-interactive px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {savingNote ? "Saving..." : "Save"}
                  </button>
                  <button type="button" onClick={() => setEditingNoteWeek(null)} className="text-xs text-muted hover:text-primary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {!editingNoteWeek && localNotes[week.weekStart] && (
              <p
                className="mb-2 cursor-pointer rounded-lg bg-surface-muted px-2 py-1 text-xs text-tertiary italic hover:bg-surface-subtle"
                onClick={() => setEditingNoteWeek(week.weekStart)}
              >
                {localNotes[week.weekStart]}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 md:grid-cols-7">
              {" "}
              {week.days.map((day) => {
                const today = isToday(day.date);
                const stats = dayStats.get(day.date) || {
                  totalLessons: 0,
                  completedLessons: 0,
                };
                const { totalLessons, completedLessons } = stats;
                const externalEvents = day.externalEvents || [];
                const isWeekend =
                  day.subjects.length === 0 &&
                  [0, 6].includes(new Date(day.date + "T00:00:00").getDay());
                return (
                  <div
                    key={day.date}
                    data-day-date={day.date}
                    onClick={() => handleDayClick(day, totalLessons)}
                    onDragOver={(event) => {
                      if (
                        !draggingLesson ||
                        isPending ||
                        draggingLesson.fromDate === day.date
                      )
                        return;
                      event.preventDefault();
                      setDropTargetDate(day.date);
                    }}
                    onDragLeave={() => {
                      if (dropTargetDate === day.date) setDropTargetDate(null);
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDrop(day.date);
                    }}
                    className={`flex min-h-[150px] flex-col rounded-2xl border transition-colors md:min-h-[140px] ${today ? "border-interactive-border bg-interactive-light/30/20" : "border-light bg-surface-slate"} ${dropTargetDate === day.date ? "border-primary-400 ring-2 ring-primary-200" : ""} ${totalLessons > 0 ? "cursor-pointer hover:border-interactive-border hover:shadow-sm" : ""}`}
                  >
                    {" "}
                    {/* Day header */}{" "}
                    <div className="flex items-baseline justify-between border-b border-light px-2 py-1.5">
                      {" "}
                      <div>
                        {" "}
                        <span
                          className={`text-xs font-semibold ${today ? "text-interactive-hover" : "text-primary"}`}
                        >
                          {" "}
                          {formatWeekdayShort(day.date)}{" "}
                        </span>{" "}
                        <span className="ml-1 text-xs text-muted">
                          {" "}
                          {formatShortDate(day.date)}{" "}
                        </span>{" "}
                      </div>{" "}
                      {totalLessons > 0 && (
                        <span className="text-xs text-muted">
                          {" "}
                          {completedLessons}/{totalLessons}{" "}
                        </span>
                      )}{" "}
                    </div>{" "}
                    {/* Subject list with lesson titles */}{" "}
                    <div className="flex-1 space-y-1 p-1.5">
                      {" "}
                      {externalEvents.length > 0 && (
                        <div className="space-y-1">
                          {" "}
                          {externalEvents.map((event) => (
                            <div
                              key={`${event.event_id}-${event.date}`}
                              className="rounded border border-dashed border-border bg-surface-muted/80 px-1.5 py-1/70"
                            >
                              {" "}
                              <div className="flex items-center gap-1">
                                {" "}
                                <span className="text-[10px]">🏫</span>{" "}
                                <span
                                  className="h-1.5 w-1.5 rounded-full"
                                  style={{ backgroundColor: event.color }}
                                />{" "}
                                <span className="line-clamp-2 text-[11px] font-semibold text-secondary">
                                  {" "}
                                  {event.title}{" "}
                                </span>{" "}
                              </div>{" "}
                              {formatTimeRange(
                                event.start_time,
                                event.end_time,
                                event.all_day,
                              ) && (
                                <p className="mt-0.5 text-[10px] text-muted">
                                  {" "}
                                  {formatTimeRange(
                                    event.start_time,
                                    event.end_time,
                                    event.all_day,
                                  )}{" "}
                                </p>
                              )}{" "}
                            </div>
                          ))}{" "}
                        </div>
                      )}{" "}
                      {totalLessons === 0 ? (
                        <p className="py-2 text-center text-xs text-border">
                          {" "}
                          {isWeekend ? "Weekend" : "No lessons"}{" "}
                        </p>
                      ) : (
                        day.subjects.map((subject) => (
                          <div key={subject.subjectName}>
                            {" "}
                            <div className="flex items-center gap-1 px-0.5">
                              {" "}
                              <span
                                className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                                style={{
                                  backgroundColor:
                                    subject.subjectColor || "#6366f1",
                                }}
                              />{" "}
                              <span className="sr-only">
                                Subject color indicator
                              </span>{" "}
                              <span className="line-clamp-2 text-xs font-semibold text-secondary">
                                {" "}
                                {subject.subjectName}{" "}
                              </span>{" "}
                            </div>{" "}
                            <div className="mt-0.5 space-y-1 pl-3">
                              {" "}
                              {groupByCourse(subject.lessons).map(([courseName, courseGroup]) => (
                                <div key={courseName}>
                                  <Link
                                    href={`/curricula/${courseGroup.curriculum_id}`}
                                    onClick={(e) => e.stopPropagation()}
                                    className="line-clamp-1 text-xs text-interactive hover:underline"
                                  >
                                    {courseName}
                                  </Link>
                                  <div className="mt-0.5 space-y-0.5 pl-2">
                                    {courseGroup.lessons.map((lesson) => (
                                      <button
                                        key={lesson.id}
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (
                                            touchDragging ||
                                            suppressNextClick.current
                                          ) {
                                            suppressNextClick.current = false;
                                            return;
                                          }
                                          setDetailLessonId(lesson.id);
                                          setDetailOpen(true);
                                        }}
                                        draggable={!isPending}
                                        onDragStart={(event) => {
                                          event.stopPropagation();
                                          setDraggingLesson({
                                            id: lesson.id,
                                            fromDate: day.date,
                                            subjectName: subject.subjectName,
                                            subjectColor: subject.subjectColor,
                                          });
                                        }}
                                        onDragEnd={() => {
                                          setDraggingLesson(null);
                                          setDropTargetDate(null);
                                        }}
                                        onTouchStart={(event) =>
                                          handleTouchStart(event, {
                                            id: lesson.id,
                                            fromDate: day.date,
                                            subjectName: subject.subjectName,
                                            subjectColor: subject.subjectColor,
                                          })
                                        }
                                        onTouchMove={handleTouchMove}
                                        onTouchEnd={handleTouchEnd}
                                        onTouchCancel={handleTouchCancel}
                                        className={`block text-left text-sm leading-tight transition-colors hover:text-interactive md:text-xs ${lesson.status === "completed" ? "text-muted line-through" : "text-tertiary"}`}
                                      >
                                        <span className="line-clamp-2">{lesson.title}</span>
                                        {(() => {
                                          const items = parseChecklist(lesson.description);
                                          if (items.length === 0) return null;
                                          const { checked, total } = checklistProgress(items, lesson.checklist_state || {});
                                          return (
                                            <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted no-underline" style={{ textDecoration: 'none' }}>
                                              <span className="text-[var(--success-solid)]">&#10003;</span> {checked}/{total}
                                            </span>
                                          );
                                        })()}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              ))}{" "}
                            </div>{" "}
                          </div>
                        ))
                      )}{" "}
                    </div>{" "}
                  </div>
                );
              })}{" "}
            </div>{" "}
          </div>
        ))}{" "}
      </div>{" "}
      <DayModal
        open={!!selectedDay}
        onClose={() => setSelectedDay(null)}
        title={
          selectedDay
            ? `${formatWeekdayShort(selectedDay.date)}, ${formatShortDate(selectedDay.date)}`
            : ""
        }
        subjects={selectedDay?.subjects || []}
        externalEvents={selectedDay?.externalEvents || []}
        onLessonClick={(id) => {
          setSelectedDay(null);
          setDetailLessonId(id);
          setDetailOpen(true);
        }}
      />
      <LessonDetailModal
        lessonId={detailLessonId}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {}}
        onChanged={() => {
          setDetailOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
