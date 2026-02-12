"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import LessonFormModal from "./LessonFormModal";

type Lesson = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  planned_date: string | null;
  curriculum_id: string;
  curriculum_name: string;
  subject_id: string;
  subject_name: string;
  subject_color: string;
  child_id: string;
  child_name: string;
  grade: number | null;
  completion_notes: string | null;
  completed_at: string | null;
};

type Child = { id: string; name: string };

type SortField = "planned_date" | "title" | "status";
type SortDir = "asc" | "desc";

function toSafeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

const statusVariant: Record<string, "default" | "warning" | "success"> = {
  planned: "default",
  in_progress: "warning",
  completed: "success",
};

const statusLabel: Record<string, string> = {
  planned: "Planned",
  in_progress: "In Progress",
  completed: "Completed",
};

const statusOrder: Record<string, number> = {
  planned: 0,
  in_progress: 1,
  completed: 2,
};

export default function LessonsTable({
  lessons,
  children,
}: {
  lessons: Lesson[];
  children: Child[];
}) {
  const router = useRouter();

  // Filter state
  const [childFilter, setChildFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [curriculumFilter, setCurriculumFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Expanded rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Sort state
  const [sortField, setSortField] = useState<SortField>("planned_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Edit modal state
  const [editLesson, setEditLesson] = useState<Lesson | null>(null);

  // Derive filter options from data
  const subjects = useMemo(() => {
    const map = new Map<string, string>();
    for (const l of lessons) {
      if (!l.subject_id) continue;
      map.set(l.subject_id, toSafeText(l.subject_name));
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [lessons]);

  const curricula = useMemo(() => {
    const filtered = subjectFilter
      ? lessons.filter((l) => l.subject_id === subjectFilter)
      : lessons;
    const map = new Map<string, string>();
    for (const l of filtered) {
      if (!l.curriculum_id) continue;
      map.set(l.curriculum_id, toSafeText(l.curriculum_name));
    }
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [lessons, subjectFilter]);

  // Reset curriculum filter when subject changes and it's no longer valid
  const effectiveCurriculumFilter = curricula.some(
    (c) => c.id === curriculumFilter,
  )
    ? curriculumFilter
    : "";

  function toggleExpanded(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Filter + sort
  const filtered = useMemo(() => {
    let result = lessons;
    if (childFilter) result = result.filter((l) => l.child_id === childFilter);
    if (subjectFilter)
      result = result.filter((l) => l.subject_id === subjectFilter);
    if (effectiveCurriculumFilter)
      result = result.filter(
        (l) => l.curriculum_id === effectiveCurriculumFilter,
      );
    if (statusFilter) result = result.filter((l) => l.status === statusFilter);

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "title") {
        cmp = toSafeText(a.title).localeCompare(toSafeText(b.title));
      } else if (sortField === "status") {
        cmp = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
      } else {
        // planned_date — nulls last
        const da = a.planned_date;
        const db = b.planned_date;
        if (!da && !db) cmp = 0;
        else if (!da) cmp = 1;
        else if (!db) cmp = -1;
        else cmp = da.localeCompare(db);
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [
    lessons,
    childFilter,
    subjectFilter,
    effectiveCurriculumFilter,
    statusFilter,
    sortField,
    sortDir,
  ]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  function sortIndicator(field: SortField) {
    if (sortField !== field) return "";
    return sortDir === "asc" ? " \u2191" : " \u2193";
  }

  return (
    <>
      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        {children.length > 1 && (
          <select
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            className="rounded-lg border bg-surface px-3 py-2 text-sm"
          >
            <option value="">All Students</option>
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}

        <select
          value={subjectFilter}
          onChange={(e) => {
            setSubjectFilter(e.target.value);
            setCurriculumFilter("");
          }}
          className="rounded-lg border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All Subjects</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={effectiveCurriculumFilter}
          onChange={(e) => setCurriculumFilter(e.target.value)}
          className="rounded-lg border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All Curricula</option>
          {curricula.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All Statuses</option>
          <option value="planned">Planned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>

        <span className="text-sm text-muted">
          {filtered.length} lesson{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border bg-surface shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-surface-muted">
            <tr>
              <th
                onClick={() => toggleSort("title")}
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted hover:text-secondary"
              >
                Title{sortIndicator("title")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                Student
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                Subject
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                Curriculum
              </th>
              <th
                onClick={() => toggleSort("status")}
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted hover:text-secondary"
              >
                Status{sortIndicator("status")}
              </th>
              <th
                onClick={() => toggleSort("planned_date")}
                className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted hover:text-secondary"
              >
                Due Date{sortIndicator("planned_date")}
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                Grade
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filtered.map((lesson) => {
              const isExpanded = expandedRows.has(lesson.id);
              const hasDetails = lesson.description || lesson.completion_notes;
              return (
                <tr
                  key={lesson.id}
                  onClick={() => router.push(`/lessons/${lesson.id}`)}
                  className="group cursor-pointer hover:bg-surface-muted"
                >
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-start gap-2">
                      {hasDetails && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleExpanded(lesson.id);
                          }}
                          className="mt-0.5 flex-shrink-0 text-xs text-muted hover:text-tertiary"
                        >
                          {isExpanded ? "▾" : "▸"}
                        </button>
                      )}
                      <div className="min-w-0">
                        <span className="font-medium text-primary">
                          {toSafeText(lesson.title) || "Untitled lesson"}
                        </span>
                        {isExpanded && lesson.description && (
                          <p className="mt-1 text-xs text-muted whitespace-pre-wrap line-clamp-4">
                            {lesson.description}
                          </p>
                        )}
                        {isExpanded && lesson.completion_notes && (
                          <p className="mt-1 text-xs italic text-muted">
                            Note: {lesson.completion_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-tertiary">
                    {toSafeText(lesson.child_name) || "Unknown student"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Badge variant="primary">
                      {toSafeText(lesson.subject_name) || "Unknown subject"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-tertiary">
                    {toSafeText(lesson.curriculum_name) || "Unknown curriculum"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <Badge variant={statusVariant[lesson.status] || "default"}>
                      {statusLabel[lesson.status] || lesson.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-tertiary">
                    {lesson.planned_date
                      ? new Date(lesson.planned_date).toLocaleDateString()
                      : "\u2014"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-semibold text-interactive">
                    {lesson.grade != null
                      ? Number(lesson.grade).toFixed(0)
                      : "\u2014"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditLesson(lesson);
                      }}
                      className="rounded px-2 py-1 text-xs font-medium text-interactive hover:bg-interactive-light"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-sm text-muted"
                >
                  No lessons match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      <LessonFormModal
        open={!!editLesson}
        onClose={() => setEditLesson(null)}
        lesson={
          editLesson
            ? {
                id: editLesson.id,
                title: editLesson.title,
                description: editLesson.description,
                planned_date: editLesson.planned_date,
                curriculum_id: editLesson.curriculum_id,
                subject_name: editLesson.subject_name,
                child_id: editLesson.child_id,
              }
            : null
        }
        children={children}
      />
    </>
  );
}
