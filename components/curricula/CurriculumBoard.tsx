"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import { updateLessonStatus } from "@/lib/actions/lessons";
import { markLessonComplete } from "@/lib/actions/completions";

// ============================================================================
// Types
// ============================================================================

type LessonResource = {
  id: string;
  lesson_id: string;
  type: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  resource_id: string | null;
  global_type: string | null;
  global_thumbnail_url: string | null;
  resource_description: string | null;
};

type Completion = {
  lesson_id: string;
  child_id: string;
  child_name: string;
  completed_at: string;
  grade: number | null;
  notes: string | null;
};

type Lesson = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  planned_date: string | null;
  order_index: number;
  estimated_duration: number | null;
  resources: LessonResource[];
  completions: Completion[];
};

type CurriculumResource = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
};

type Child = {
  id: string;
  name: string;
};

type BoardProps = {
  curriculumId: string;
  subjectColor: string | null;
  lessons: Lesson[];
  children: Child[];
  curriculumResources: CurriculumResource[];
};

// ============================================================================
// Helpers
// ============================================================================

const typeConfig: Record<string, { icon: string; bg: string }> = {
  youtube: { icon: "▶", bg: "from-red-50 to-red-100" },
  video: { icon: "🎬", bg: "from-red-50 to-red-100" },
  pdf: { icon: "📄", bg: "from-amber-50 to-orange-100" },
  filerun: { icon: "📁", bg: "from-blue-50 to-blue-100" },
  url: { icon: "🔗", bg: "from-cyan-50 to-blue-100" },
  link: { icon: "🔗", bg: "from-cyan-50 to-blue-100" },
  book: { icon: "📕", bg: "from-indigo-50 to-purple-100" },
  supply: { icon: "🧰", bg: "from-gray-50 to-slate-100" },
};

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

const statusColors: Record<string, string> = {
  planned: "border-gray-200",
  in_progress: "border-warning-400",
  completed: "border-success-400",
};

const statusBadge: Record<string, "default" | "warning" | "success"> = {
  planned: "default",
  in_progress: "warning",
  completed: "success",
};

// ============================================================================
// Sub-components
// ============================================================================

function ResourceMiniCard({
  type,
  url,
  title,
  thumbnailUrl,
}: {
  type: string;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
}) {
  const cfg = typeConfig[type] || typeConfig.url;
  const displayTitle = title || "Untitled";
  const youtubeId = (type === "youtube" || type === "video") ? extractYoutubeId(url) : null;

  const thumbnail = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
    : thumbnailUrl;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2 text-xs transition-colors hover:border-primary-200 hover:bg-primary-50/30"
      onClick={(e) => e.stopPropagation()}
    >
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt=""
          className="h-8 w-12 flex-shrink-0 rounded object-cover"
        />
      ) : (
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${cfg.bg} text-sm`}
        >
          {cfg.icon}
        </span>
      )}
      <span className="min-w-0 truncate text-gray-700 group-hover:text-primary-600">
        {displayTitle}
      </span>
    </a>
  );
}

function CompletionCheckbox({
  lessonId,
  child,
  completed,
  grade,
  isPending,
  onToggle,
}: {
  lessonId: string;
  child: Child;
  completed: boolean;
  grade: number | null;
  isPending: boolean;
  onToggle: (lessonId: string, childId: string, completed: boolean) => void;
}) {
  return (
    <label
      className="flex cursor-pointer items-center gap-1.5"
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={completed}
        disabled={isPending}
        onChange={() => onToggle(lessonId, child.id, !completed)}
        className="rounded border-gray-300 text-success-600 focus:ring-success-500 disabled:opacity-50"
      />
      <span className={`text-xs ${completed ? "text-success-700" : "text-gray-500"}`}>
        {child.name}
      </span>
      {grade != null && (
        <span className="text-xs font-semibold text-primary-600">
          {Number(grade).toFixed(0)}
        </span>
      )}
    </label>
  );
}

// ============================================================================
// Main Board Component
// ============================================================================

export default function CurriculumBoard({
  curriculumId,
  subjectColor,
  lessons,
  children: assignedChildren,
  curriculumResources,
}: BoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleCompletionToggle(
    lessonId: string,
    childId: string,
    shouldComplete: boolean
  ) {
    startTransition(async () => {
      if (shouldComplete) {
        const fd = new FormData();
        fd.set("lessonId", lessonId);
        fd.set("childId", childId);
        await markLessonComplete(fd);
      } else {
        await updateLessonStatus(lessonId, "planned");
      }
      router.refresh();
    });
  }

  // Group curriculum resources by type
  const resourcesByType = curriculumResources.reduce(
    (acc, r) => {
      const group = r.type === "book" ? "Books" : r.type === "video" ? "Videos" : r.type === "supply" ? "Supplies" : "Other";
      if (!acc[group]) acc[group] = [];
      acc[group].push(r);
      return acc;
    },
    {} as Record<string, CurriculumResource[]>
  );

  const hasResources = curriculumResources.length > 0;

  return (
    <div className="relative">
      {/* Saving indicator */}
      {isPending && (
        <div className="absolute right-0 top-0 z-10 rounded-lg bg-primary-50 px-3 py-1 text-xs font-medium text-primary-600 animate-pulse">
          Saving...
        </div>
      )}

      {/* Horizontal scroll container */}
      <div className="flex gap-4 overflow-x-auto pb-4" style={{ scrollSnapType: "x mandatory" }}>
        {/* Resources Column (fixed left) */}
        {hasResources && (
          <div
            className="w-64 flex-shrink-0 rounded-xl border border-gray-200 bg-gray-50 shadow-sm"
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="border-b bg-white px-4 py-3 rounded-t-xl">
              <h3 className="text-sm font-semibold text-gray-900">
                Curriculum Resources
              </h3>
              <p className="text-xs text-gray-400">
                {curriculumResources.length} shared
              </p>
            </div>
            <div className="space-y-4 p-3">
              {Object.entries(resourcesByType).map(([group, resources]) => (
                <div key={group}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {group}
                  </p>
                  <div className="space-y-1.5">
                    {resources.map((r) => {
                      const cfg = typeConfig[r.type] || typeConfig.url;
                      return (
                        <a
                          key={r.id}
                          href={r.url || `/resources/${r.id}`}
                          target={r.url ? "_blank" : undefined}
                          rel={r.url ? "noopener noreferrer" : undefined}
                          className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white p-2 text-xs transition-colors hover:border-primary-200"
                        >
                          {r.thumbnail_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={r.thumbnail_url}
                              alt=""
                              className="h-8 w-10 flex-shrink-0 rounded object-cover"
                            />
                          ) : (
                            <span
                              className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${cfg.bg} text-sm`}
                            >
                              {cfg.icon}
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-gray-700">
                              {r.title}
                            </p>
                            {r.description && (
                              <p className="truncate text-[10px] text-gray-400">
                                {r.description}
                              </p>
                            )}
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lesson Columns */}
        {lessons.map((lesson, idx) => {
          const completedChildIds = new Set(
            lesson.completions.map((c) => c.child_id)
          );
          const allCompleted =
            assignedChildren.length > 0 &&
            assignedChildren.every((c) => completedChildIds.has(c.id));
          const borderColor = allCompleted
            ? "border-success-400"
            : statusColors[lesson.status] || "border-gray-200";

          return (
            <div
              key={lesson.id}
              className={`w-64 flex-shrink-0 rounded-xl border-2 bg-white shadow-sm transition-shadow hover:shadow-md ${borderColor}`}
              style={{ scrollSnapAlign: "start" }}
            >
              {/* Header with color bar */}
              <div
                className="h-1.5 rounded-t-[10px]"
                style={{ backgroundColor: subjectColor || "#6366f1" }}
              />

              {/* Lesson number & date */}
              <div className="border-b px-4 py-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Lesson {idx + 1}
                  </span>
                  <Badge variant={statusBadge[lesson.status] || "default"}>
                    {lesson.status === "in_progress" ? "In Progress" : lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}
                  </Badge>
                </div>
                {lesson.planned_date && (
                  <p className="mt-0.5 text-xs text-gray-500">
                    {new Date(lesson.planned_date + "T00:00:00").toLocaleDateString(
                      undefined,
                      { weekday: "short", month: "short", day: "numeric" }
                    )}
                  </p>
                )}
              </div>

              {/* Title & description — clickable to lesson detail */}
              <Link
                href={`/lessons/${lesson.id}`}
                className="block px-4 py-3 transition-colors hover:bg-gray-50"
              >
                <h4 className="text-sm font-semibold text-gray-900 line-clamp-2">
                  {lesson.title}
                </h4>
                {lesson.description && (
                  <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                    {lesson.description}
                  </p>
                )}
                {lesson.estimated_duration && (
                  <p className="mt-1 text-[10px] text-gray-400">
                    ~{lesson.estimated_duration} min
                  </p>
                )}
              </Link>

              {/* Resources */}
              {lesson.resources.length > 0 && (
                <div className="border-t px-3 py-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Resources ({lesson.resources.length})
                  </p>
                  <div className="space-y-1.5">
                    {lesson.resources.map((r) => (
                      <ResourceMiniCard
                        key={r.id}
                        type={r.global_type || r.type}
                        url={r.url}
                        title={r.title}
                        thumbnailUrl={r.global_thumbnail_url || r.thumbnail_url}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Completion checkboxes */}
              {assignedChildren.length > 0 && (
                <div className="border-t px-4 py-2.5">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Completion
                  </p>
                  <div className="space-y-1">
                    {assignedChildren.map((child) => {
                      const completion = lesson.completions.find(
                        (c) => c.child_id === child.id
                      );
                      return (
                        <CompletionCheckbox
                          key={child.id}
                          lessonId={lesson.id}
                          child={child}
                          completed={!!completion}
                          grade={completion?.grade ?? null}
                          isPending={isPending}
                          onToggle={handleCompletionToggle}
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {lessons.length === 0 && (
          <div className="flex w-full items-center justify-center py-16 text-sm text-gray-400">
            No lessons in this curriculum yet.
          </div>
        )}
      </div>
    </div>
  );
}
