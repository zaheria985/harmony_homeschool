"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import RowActions from "@/components/ui/RowActions";
import BulkSelectBar from "@/components/ui/BulkSelectBar";
import LessonFormModal from "@/components/lessons/LessonFormModal";
import { deleteLesson, bulkDeleteLessons } from "@/lib/actions/lessons";

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
  children,
  curriculumId,
}: {
  lessons: Lesson[];
  childId: string;
  children: { id: string; name: string }[];
  curriculumId: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterOption>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);

  // Clear selection when filter changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [filter]);

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((l) => l.id)));
    }
  }

  async function handleBulkDelete() {
    setIsDeleting(true);
    await bulkDeleteLessons(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsDeleting(false);
    router.refresh();
  }

  async function handleSingleDelete(id: string) {
    await deleteLesson(id);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    router.refresh();
  }

  return (
    <div>
      {/* Filter tabs */}
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

      {/* Bulk select bar */}
      <BulkSelectBar
        selectedCount={selectedIds.size}
        totalCount={filtered.length}
        onToggleSelectAll={toggleSelectAll}
        onBulkDelete={handleBulkDelete}
        isDeleting={isDeleting}
      />

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
              {/* Selection checkbox */}
              <input
                type="checkbox"
                checked={selectedIds.has(l.id)}
                onChange={() => toggleSelect(l.id)}
                className="rounded border-border text-interactive focus:ring-focus"
              />

              {/* Lesson link */}
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

              {/* Row actions */}
              <RowActions
                onView={() => router.push(`/lessons/${l.id}`)}
                onEdit={() => setEditingLesson(l)}
                onDelete={() => handleSingleDelete(l.id)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <LessonFormModal
        open={!!editingLesson}
        onClose={() => setEditingLesson(null)}
        lesson={
          editingLesson
            ? {
                id: editingLesson.id,
                title: editingLesson.title,
                description: editingLesson.description,
                planned_date: editingLesson.planned_date,
                curriculum_id: curriculumId,
                child_id: childId,
              }
            : null
        }
        children={children}
      />
    </div>
  );
}
