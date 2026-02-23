"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import LessonCompleteCheckbox from "@/components/lessons/LessonCompleteCheckbox";

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  planned_date: string | null;
  grade: number | null;
};

type FilterOption = "all" | "incomplete" | "completed";

export default function CurriculumLessonsList({
  lessons,
  childId,
}: {
  lessons: Lesson[];
  childId: string;
}) {
  const [filter, setFilter] = useState<FilterOption>("all");

  const completedCount = lessons.filter((l) => l.status === "completed").length;
  const incompleteCount = lessons.length - completedCount;

  const filtered =
    filter === "all"
      ? lessons
      : filter === "completed"
        ? lessons.filter((l) => l.status === "completed")
        : lessons.filter((l) => l.status !== "completed");

  const tabs: { key: FilterOption; label: string; count: number }[] = [
    { key: "all", label: "All", count: lessons.length },
    { key: "incomplete", label: "Incomplete", count: incompleteCount },
    { key: "completed", label: "Completed", count: completedCount },
  ];

  return (
    <div>
      <div className="mb-4 flex gap-1 rounded-lg bg-surface-muted p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === tab.key
                ? "bg-surface text-primary shadow-sm"
                : "text-muted hover:text-secondary"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="py-4 text-center text-muted">
          No {filter === "all" ? "" : filter} lessons
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((l) => (
            <div
              key={l.id}
              className="flex items-center gap-3 rounded-lg border p-4 transition-colors hover:bg-surface-muted"
            >
              <div
                className="flex-shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <LessonCompleteCheckbox
                  lessonId={l.id}
                  childId={childId}
                  completed={l.status === "completed"}
                />
              </div>
              <Link
                href={`/lessons/${l.id}`}
                className="flex min-w-0 flex-1 items-center justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{l.title}</p>
                  {l.description && (
                    <p className="mt-0.5 text-sm text-muted">{l.description}</p>
                  )}
                  {l.planned_date && (
                    <p className="mt-0.5 text-xs text-muted">
                      {new Date(l.planned_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {l.grade != null && (
                    <span className="font-semibold text-interactive">
                      {Number(l.grade).toFixed(0)}
                    </span>
                  )}
                  <Badge
                    variant={
                      l.status === "completed"
                        ? "success"
                        : l.status === "in_progress"
                          ? "warning"
                          : "default"
                    }
                  >
                    {l.status}
                  </Badge>
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
