"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import ViewToggle from "@/components/ui/ViewToggle";
import EditableCell from "@/components/ui/EditableCell";
import { updateCurriculum } from "@/lib/actions/lessons";

type Curriculum = {
  id: string;
  name: string;
  description: string | null;
  order_index: number;
  cover_image: string | null;
  course_type: "curriculum" | "unit_study";
  status: "active" | "archived" | "draft";
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
}: {
  curricula: Curriculum[];
  children: Child[];
  subjects: SubjectOption[];
}) {
  const router = useRouter();
  const [view, setView] = useState("gallery");
  const [childFilter, setChildFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  // Derive subject options from data, scoped to child filter
  const subjectFilterOptions = useMemo(() => {
    const source = childFilter
      ? curricula.filter((c) => c.child_id === childFilter)
      : curricula;
    const map = new Map<string, string>();
    for (const c of source) map.set(c.subject_id, c.subject_name);
    return Array.from(map, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [curricula, childFilter]);

  const effectiveSubjectFilter = subjectFilterOptions.some(
    (s) => s.id === subjectFilter
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

  const galleryFiltered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const oneYearOut = new Date(today);
    oneYearOut.setFullYear(oneYearOut.getFullYear() + 1);

    return filtered.filter((c) => {
      if (c.status !== "active") return false;
      if (!c.end_date) return false;
      const due = new Date(`${c.end_date}T00:00:00`);
      return due >= today && due <= oneYearOut;
    });
  }, [filtered]);

  const saveCurriculumField = useCallback(
    (
      curriculum: Curriculum,
      field: "name" | "description" | "subject_id" | "cover_image" | "course_type"
    ) =>
      async (value: string) => {
        const formData = new FormData();
        formData.set("id", curriculum.id);
        formData.set("name", field === "name" ? value : curriculum.name);
        formData.set(
          "description",
          field === "description" ? value : curriculum.description || ""
        );
        formData.set(
          "cover_image",
          field === "cover_image" ? value : curriculum.cover_image || ""
        );
        formData.set(
          "course_type",
          field === "course_type" ? value : curriculum.course_type
        );
        if (field === "subject_id") formData.set("subject_id", value);
        return updateCurriculum(formData);
      },
    []
  );

  // Get subject options (global subjects)
  const subjectOptions = useMemo(
    () => subjects.map((s) => ({ value: s.id, label: s.name })),
    [subjects]
  );

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
          className="rounded-lg border bg-white px-3 py-2 text-sm"
        >
          <option value="">All Students</option>
          {children.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        <select
          value={effectiveSubjectFilter}
          onChange={(e) => setSubjectFilter(e.target.value)}
          className="rounded-lg border bg-white px-3 py-2 text-sm"
        >
          <option value="">All Subjects</option>
          {subjectFilterOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <span className="text-sm text-gray-500">
          {filtered.length} course{filtered.length === 1 ? "" : "s"}
        </span>

        <div className="ml-auto">
          <ViewToggle
            storageKey="curricula-view"
            options={[
              { key: "gallery", label: "Gallery" },
              { key: "table", label: "Table" },
            ]}
            defaultView="gallery"
            onChange={setView}
          />
        </div>
      </div>

      {view === "table" && filtered.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-400">
          No courses match the selected filters.
        </p>
      )}

      {view === "gallery" && galleryFiltered.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-400">
          No active courses due in the next 12 months match the selected filters.
        </p>
      )}

      {/* Gallery View */}
      {view === "gallery" && galleryFiltered.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {galleryFiltered.map((curriculum) => {
            const pct =
              curriculum.lesson_count > 0
                ? Math.round(
                    (curriculum.completed_count / curriculum.lesson_count) * 100
                  )
                : 0;
            return (
              <div
                key={curriculum.id}
                onClick={() => router.push(`/curricula/${curriculum.id}`)}
                className="cursor-pointer rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Color bar from subject */}
                <div
                  className="h-2 rounded-t-xl"
                  style={{
                    backgroundColor: curriculum.subject_color || "#6366f1",
                  }}
                />
                {curriculum.cover_image && (
                  <div className="h-36 overflow-hidden border-b">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={curriculum.cover_image}
                      alt={curriculum.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="p-5">
                  <h3 className="mb-1 font-semibold text-gray-900">
                    {curriculum.name}
                  </h3>
                  <div className="mb-2 flex items-center gap-2">
                    <Badge variant="primary">{curriculum.subject_name}</Badge>
                    <Badge variant="default" >
                      {curriculum.course_type === "unit_study" ? "Unit Study" : "Curriculum"}
                    </Badge>
                    <span className="text-xs text-gray-400">
                      {curriculum.child_name}
                    </span>
                  </div>
                  {curriculum.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-gray-500">
                      {curriculum.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {curriculum.completed_count}/{curriculum.lesson_count}{" "}
                      lessons
                    </span>
                    <span className="text-xs text-gray-400">{pct}%</span>
                  </div>
                  {/* Progress bar */}
                  <div className="mt-2 h-1.5 w-full rounded-full bg-gray-100">
                    <div
                      className="h-1.5 rounded-full bg-success-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Course
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Student
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Cover Image
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Lessons
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Progress
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filtered.map((curriculum) => {
                const pct =
                  curriculum.lesson_count > 0
                    ? Math.round(
                        (curriculum.completed_count / curriculum.lesson_count) *
                          100
                      )
                    : 0;
                return (
                  <tr
                    key={curriculum.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      <EditableCell
                        value={curriculum.name}
                        onSave={saveCurriculumField(curriculum, "name")}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
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
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {curriculum.child_name}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-gray-500">
                      <EditableCell
                        value={curriculum.description || ""}
                        onSave={saveCurriculumField(curriculum, "description")}
                      />
                    </td>
                    <td className="max-w-xs px-4 py-3 text-sm text-gray-600">
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
                              <span className="max-w-[16rem] truncate text-xs text-gray-500">
                                {curriculum.cover_image}
                              </span>
                            </div>
                          ) : (
                            <span className="text-gray-400 italic">Add image URL</span>
                          )
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {curriculum.completed_count}/{curriculum.lesson_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 rounded-full bg-gray-100">
                          <div
                            className="h-1.5 rounded-full bg-success-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500">{pct}%</span>
                      </div>
                    </td>
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
