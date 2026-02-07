"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import ViewToggle from "@/components/ui/ViewToggle";
import EditableCell from "@/components/ui/EditableCell";
import { updateSubject } from "@/lib/actions/lessons";

type Subject = {
  id: string;
  name: string;
  color: string | null;
  lesson_count: number;
  completed_count: number;
  curriculum_count: number;
};

export default function SubjectsView({
  subjects,
}: {
  subjects: Subject[];
}) {
  const router = useRouter();
  const [view, setView] = useState<string>("gallery");

  const saveSubjectField = useCallback(
    (subject: Subject, field: "name" | "color") =>
      async (value: string) => {
        const formData = new FormData();
        formData.set("id", subject.id);
        formData.set("name", field === "name" ? value : subject.name);
        formData.set("color", field === "color" ? value : subject.color || "");
        return updateSubject(formData);
      },
    []
  );

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm text-gray-500">
          {subjects.length} subject{subjects.length !== 1 ? "s" : ""}
        </span>
        <div className="ml-auto">
          <ViewToggle
            storageKey="subjects-view"
            options={[
              { key: "gallery", label: "Gallery" },
              { key: "table", label: "Table" },
            ]}
            defaultView="gallery"
            onChange={setView}
          />
        </div>
      </div>

      {subjects.length === 0 && (
        <p className="py-12 text-center text-sm text-gray-400">
          No subjects yet. Create one to get started.
        </p>
      )}

      {/* Gallery View */}
      {view === "gallery" && subjects.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => {
            const pct =
              subject.lesson_count > 0
                ? Math.round((subject.completed_count / subject.lesson_count) * 100)
                : 0;
            return (
              <div
                key={subject.id}
                onClick={() => router.push(`/subjects/${subject.id}`)}
                className="cursor-pointer rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                {/* Color bar */}
                <div
                  className="h-2 rounded-t-xl"
                  style={{ backgroundColor: subject.color || "#6366f1" }}
                />
                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between">
                    <h3 className="font-semibold text-gray-900">{subject.name}</h3>
                    <span
                      className="ml-2 h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: subject.color || "#6366f1" }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">
                      {subject.curriculum_count} curricul{subject.curriculum_count === 1 ? "um" : "a"}
                    </span>
                    <span className="text-gray-500">
                      {subject.completed_count}/{subject.lesson_count} lessons
                    </span>
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
      {view === "table" && subjects.length > 0 && (
        <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Subject
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Color
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                  Curricula
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
              {subjects.map((subject) => {
                const pct =
                  subject.lesson_count > 0
                    ? Math.round(
                        (subject.completed_count / subject.lesson_count) * 100
                      )
                    : 0;
                return (
                  <tr
                    key={subject.id}
                    className="hover:bg-gray-50"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      <EditableCell
                        value={subject.name}
                        onSave={saveSubjectField(subject, "name")}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <EditableCell
                        value={subject.color || "#6366f1"}
                        onSave={saveSubjectField(subject, "color")}
                        type="color"
                        displayValue={
                          <span
                            className="inline-block h-4 w-4 rounded-full"
                            style={{ backgroundColor: subject.color || "#6366f1" }}
                          />
                        }
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {subject.curriculum_count}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {subject.completed_count}/{subject.lesson_count}
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
