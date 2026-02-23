"use client";

import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import ViewToggle from "@/components/ui/ViewToggle";
import EditableCell from "@/components/ui/EditableCell";
import { updateCurriculum, deleteCurriculum } from "@/lib/actions/lessons";
import { canEdit } from "@/lib/permissions";

type Curriculum = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  cover_image: string | null;
  course_type: "curriculum" | "unit_study";
  status: "active" | "archived" | "draft";
  start_date: string | null;
  end_date: string | null;
  subject_id: string;
  subject_name: string;
  subject_color: string | null;
  child_id: string;
  child_name: string;
  lesson_count: number;
  completed_count: number;
};

type Child = { id: string; name: string };
type SubjectOption = { id: string; name: string };

export default function CurriculaView({
  curricula,
  children,
  subjects,
  permissionLevel = "full",
}: {
  curricula: Curriculum[];
  children: Child[];
  subjects: SubjectOption[];
  permissionLevel?: string;
}) {
  const hasEditPermission = canEdit(permissionLevel);
  const router = useRouter();
  const [view, setView] = useState("gallery");
  const [childFilter, setChildFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleDeleteCurriculum = useCallback(
    (curriculum: Curriculum) => (e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        !confirm(
          "Delete this curriculum? This will also remove all its lessons.",
        )
      )
        return;
      startTransition(async () => {
        await deleteCurriculum(curriculum.id);
        router.refresh();
      });
    },
    [router],
  );

  const [timelineFilter, setTimelineFilter] = useState<
    "due-12mo" | "completed" | "future-12mo"
  >("due-12mo");

  // Derive subject options from data, scoped to child filter
  const subjectFilterOptions = useMemo(() => {
    const source = childFilter
      ? curricula.filter((c) => c.child_id === childFilter)
      : curricula;
    const map = new Map<string, string>();
    for (const c of source) map.set(c.subject_id, c.subject_name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [curricula, childFilter]);

  const effectiveSubjectFilter = subjectFilterOptions.some(
    (s) => s.id === subjectFilter,
  )
    ? subjectFilter
    : "";

  const filtered = useMemo(() => {
    let result = curricula;
    if (childFilter) result = result.filter((c) => c.child_id === childFilter);
    if (effectiveSubjectFilter)
      result = result.filter((c) => c.subject_id === effectiveSubjectFilter);
    return result;
  }, [curricula, childFilter, effectiveSubjectFilter]);

  const timelineFiltered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearOut = new Date(today);
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    return filtered.filter((c) => {
      if (timelineFilter === "completed") {
        return c.lesson_count > 0 && c.completed_count === c.lesson_count;
      }

      if (timelineFilter === "future-12mo") {
        if (!c.start_date) return false;
        const start = new Date(`${c.start_date}T00:00:00`);
        return start > oneYearOut;
      }

      if (c.status !== "active") return false;
      if (!c.end_date) return true;
      const due = new Date(`${c.end_date}T00:00:00`);
      return due >= today && due <= oneYearOut;
    });
  }, [filtered, timelineFilter]);

  const saveCurriculumField = useCallback(
    (
      curriculum: Curriculum,
      field:
        | "name"
        | "description"
        | "subject_id"
        | "cover_image"
        | "course_type",
    ) =>
      async (value: string) => {
        const formData = new FormData();
        formData.set("id", curriculum.id);
        formData.set("name", field === "name" ? value : curriculum.name);
        formData.set(
          "description",
          field === "description" ? value : curriculum.description || "",
        );
        formData.set(
          "cover_image",
          field === "cover_image" ? value : curriculum.cover_image || "",
        );
        formData.set(
          "course_type",
          field === "course_type" ? value : curriculum.course_type,
        );
        if (field === "subject_id") formData.set("subject_id", value);
        return updateCurriculum(formData);
      },
    [],
  );

  // Get subject options (global subjects)
  const subjectOptions = useMemo(
    () => subjects.map((s) => ({ value: s.id, label: s.name })),
    [subjects],
  );

  // Group curricula by subject for board view
  const bySubject = useMemo(() => {
    const map = new Map<string, { name: string; color: string | null; items: Curriculum[] }>();
    for (const c of timelineFiltered) {
      let group = map.get(c.subject_id);
      if (!group) {
        group = { name: c.subject_name, color: c.subject_color, items: [] };
        map.set(c.subject_id, group);
      }
      group.items.push(c);
    }
    return Array.from(map.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name),
    );
  }, [timelineFiltered]);

  return (
    <>
      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={childFilter}
          onChange={(e) => {
            setChildFilter(e.target.value);
            setSubjectFilter("");
          }}
          className="rounded-lg border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All Students</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={effectiveSubjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-lg border bg-surface px-3 py-2 text-sm"
        >
          <option value="">All Subjects</option>
          {subjectFilterOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={timelineFilter}
          onChange={(e) =>
            setTimelineFilter(
              e.target.value as "due-12mo" | "completed" | "future-12mo",
            )
          }
          className="rounded-lg border bg-surface px-3 py-2 text-sm"
        >
          <option value="due-12mo">Due in next 12 months</option>
          <option value="completed">Completed courses</option>
          <option value="future-12mo">Planned 12+ months out</option>
        </select>

        <span className="text-sm text-muted">
          {timelineFiltered.length} course{timelineFiltered.length === 1 ? "" : "s"}
        </span>

        <div className="ml-auto">
          <ViewToggle
            storageKey="curricula-view"
            options={[
              { key: "gallery", label: "Gallery" },
              { key: "board", label: "Board" },
              { key: "table", label: "Table" },
            ]}
            defaultView="gallery"
            onChange={setView}
          />
        </div>
      </div>

      {view === "table" && timelineFiltered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          No courses match the selected filters.
        </p>
      )}

      {view === "gallery" && timelineFiltered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          {timelineFilter === "due-12mo" &&
            "No active courses due in the next 12 months match the selected filters."}
          {timelineFilter === "completed" &&
            "No completed courses match the selected filters."}
          {timelineFilter === "future-12mo" &&
            "No courses planned to begin 12+ months from now match the selected filters."}
        </p>
      )}

      {/* Gallery View */}
      {view === "gallery" && timelineFiltered.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {timelineFiltered.map((curriculum) => {
            const pct =
              curriculum.lesson_count > 0
                ? Math.round(
                    (curriculum.completed_count / curriculum.lesson_count) *
                      100,
                  )
                : 0;
            return (
              <div
                key={curriculum.id}
                onClick={() => router.push(`/curricula/${curriculum.id}`)}
                className="group relative cursor-pointer rounded-xl border bg-surface shadow-warm transition-shadow hover:shadow-warm-md overflow-hidden"
              >
                <button
                  onClick={handleDeleteCurriculum(curriculum)}
                  disabled={isPending}
                  className="absolute right-1 top-1 z-10 rounded border border-[var(--error-border)] bg-surface/90 px-2 py-1 text-xs text-red-600 opacity-0 transition-opacity hover:bg-[var(--error-bg)] group-hover:opacity-100 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  Delete
                </button>
                {/* Cover image or color placeholder */}
                {curriculum.cover_image ? (
                  <div className="aspect-[3/4] overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={curriculum.cover_image}
                      alt={curriculum.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="aspect-[3/4] flex items-center justify-center"
                    style={{
                      backgroundColor: curriculum.subject_color || "#6366f1",
                      opacity: 0.15,
                    }}
                  >
                    <span className="text-4xl font-bold text-primary/20">
                      {curriculum.name.charAt(0)}
                    </span>
                  </div>
                )}
                <div className="p-3">
                  <h3 className="mb-1 text-sm font-semibold text-primary leading-tight line-clamp-2">
                    {curriculum.name}
                  </h3>
                  <div className="mb-1.5 flex flex-wrap items-center gap-1">
                    <Badge variant="primary">{curriculum.subject_name}</Badge>
                    <span className="text-xs text-muted">
                      {curriculum.child_name}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted">
                    <span>
                      {curriculum.completed_count}/{curriculum.lesson_count}
                    </span>
                    <span>{pct}%</span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded-full bg-surface-subtle">
                    <div
                      className="h-1 rounded-full bg-[var(--success-bg)]"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Board View — columns by subject */}
      {view === "board" && timelineFiltered.length === 0 && (
        <p className="py-12 text-center text-sm text-muted">
          No courses match the selected filters.
        </p>
      )}

      {view === "board" && timelineFiltered.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="flex gap-4 pb-4 snap-x snap-mandatory">
            {bySubject.map(([subjectId, group]) => (
              <div
                key={subjectId}
                className="w-64 flex-shrink-0 snap-start rounded-2xl border border-light bg-surface-muted/40 flex flex-col"
              >
                {/* Subject header with color bar */}
                <div
                  className="h-1.5 rounded-t-2xl"
                  style={{ backgroundColor: group.color || "#6366f1" }}
                />
                <div className="px-3 pt-2 pb-2 border-b border-light">
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-secondary">
                    {group.name}
                  </h3>
                  <p className="text-xs text-muted">
                    {group.items.length} {group.items.length === 1 ? "course" : "courses"}
                  </p>
                </div>
                {/* Curriculum cards */}
                <div className="p-2 space-y-2 overflow-y-auto max-h-[70vh] flex-1">
                  {group.items.map((curriculum) => {
                    const pct =
                      curriculum.lesson_count > 0
                        ? Math.round(
                            (curriculum.completed_count / curriculum.lesson_count) * 100,
                          )
                        : 0;
                    return (
                      <div
                        key={curriculum.id}
                        onClick={() => router.push(`/curricula/${curriculum.id}`)}
                        className="group/card relative cursor-pointer rounded-lg border bg-surface shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                      >
                        <button
                          onClick={handleDeleteCurriculum(curriculum)}
                          disabled={isPending}
                          className="absolute right-1 top-1 z-10 rounded border border-[var(--error-border)] bg-surface/90 px-1.5 py-0.5 text-xs text-red-600 opacity-0 transition-opacity hover:bg-[var(--error-bg)] group-hover/card:opacity-100 dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/30"
                        >
                          Delete
                        </button>
                        {curriculum.cover_image ? (
                          <div className="aspect-[3/4] overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={curriculum.cover_image}
                              alt={curriculum.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                        ) : (
                          <div
                            className="h-12 flex items-center justify-center"
                            style={{
                              backgroundColor: curriculum.subject_color || "#6366f1",
                              opacity: 0.15,
                            }}
                          />
                        )}
                        <div className="p-2">
                          <p className="text-sm font-medium text-primary leading-tight line-clamp-2">
                            {curriculum.name}
                          </p>
                          <p className="text-xs text-muted mt-0.5">{curriculum.child_name}</p>
                          <div className="mt-1.5 flex items-center justify-between text-xs text-muted">
                            <span>
                              {curriculum.completed_count}/{curriculum.lesson_count}
                            </span>
                            <span>{pct}%</span>
                          </div>
                          <div className="mt-1 h-1 w-full rounded-full bg-surface-subtle">
                            <div
                              className="h-1 rounded-full bg-[var(--success-bg)]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Table View */}
      {view === "table" && timelineFiltered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-surface shadow-warm">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-surface-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Course
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Cover Image
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Lessons
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  Progress
                </th>
                {hasEditPermission && (
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted">
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {timelineFiltered.map((curriculum) => {
                const pct =
                  curriculum.lesson_count > 0
                    ? Math.round(
                        (curriculum.completed_count / curriculum.lesson_count) *
                          100,
                      )
                    : 0;
                return (
                  <tr key={curriculum.id} className="hover:bg-surface-muted">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-primary">
                      <EditableCell
                        value={curriculum.name}
                        onSave={saveCurriculumField(curriculum, "name")}
                        readOnly={!hasEditPermission}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-tertiary">
                      <EditableCell
                        value={curriculum.course_type}
                        onSave={saveCurriculumField(curriculum, "course_type")}
                        type="select"
                        options={[
                          { value: "curriculum", label: "Curriculum" },
                          { value: "unit_study", label: "Unit Study" },
                        ]}
                        displayValue={
                          <span className="capitalize">
                            {curriculum.course_type.replace("_", " ")}
                          </span>
                        }
                        readOnly={!hasEditPermission}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <EditableCell
                        value={curriculum.subject_id}
                        onSave={saveCurriculumField(curriculum, "subject_id")}
                        type="select"
                        options={subjectOptions}
                        displayValue={
                          <div className="flex items-center gap-2">
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{
                                backgroundColor:
                                  curriculum.subject_color || "#6366f1",
                              }}
                            />
                            {curriculum.subject_name}
                          </div>
                        }
                        readOnly={!hasEditPermission}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-tertiary">
                      {curriculum.child_name}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-muted">
                      <EditableCell
                        value={curriculum.description || ""}
                        onSave={saveCurriculumField(curriculum, "description")}
                        readOnly={!hasEditPermission}
                      />
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-tertiary">
                      <EditableCell
                        value={curriculum.cover_image || ""}
                        onSave={saveCurriculumField(curriculum, "cover_image")}
                        displayValue={
                          curriculum.cover_image ? (
                            <div className="flex items-center gap-2">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={curriculum.cover_image}
                                alt={curriculum.name}
                                className="h-8 w-8 rounded object-cover"
                              />
                              <span className="max-w-[16rem] truncate text-xs text-muted">
                                {curriculum.cover_image}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted italic">
                              Add image URL
                            </span>
                          )
                        }
                        readOnly={!hasEditPermission}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-tertiary">
                      {curriculum.completed_count}/{curriculum.lesson_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-surface-subtle">
                          <div
                            className="h-1.5 rounded-full bg-[var(--success-bg)]"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted">{pct}%</span>
                      </div>
                    </td>
                    {hasEditPermission && (
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCurriculum(curriculum)(e);
                          }}
                          disabled={isPending}
                          className="rounded border border-[var(--error-border)] px-2 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)] dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/30"
                        >
                          Delete
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
