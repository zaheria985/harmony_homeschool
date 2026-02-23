"use client";

import { useState, useTransition } from "react";
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
  section: string | null;
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
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

const statusColors: Record<string, string> = {
  planned: "border-light",
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
  const youtubeId =
    type === "youtube" || type === "video" ? extractYoutubeId(url) : null;

  const thumbnail = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
    : thumbnailUrl;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-light bg-surface p-2 text-xs transition-colors hover:border-primary-200 hover:bg-interactive-light/30"
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
      <span className="min-w-0 truncate text-secondary group-hover:text-interactive">
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
        className="rounded border-border text-success-600 focus:ring-success-500 disabled:opacity-50"
      />
      <span
        className={`text-xs ${completed ? "text-success-700" : "text-muted"}`}
      >
        {child.name}
      </span>
      {grade != null && (
        <span className="text-xs font-semibold text-interactive">
          {Number(grade).toFixed(0)}
        </span>
      )}
    </label>
  );
}

// ============================================================================
// Section-grouped sub-components
// ============================================================================

function LessonMiniCard({
  lesson,
  assignedChildren,
  isPending,
  onCompletionToggle,
}: {
  lesson: Lesson;
  assignedChildren: Child[];
  isPending: boolean;
  onCompletionToggle: (lessonId: string, childId: string, shouldComplete: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const completedChildIds = new Set(lesson.completions.map((c) => c.child_id));
  const allCompleted =
    assignedChildren.length > 0 &&
    assignedChildren.every((c) => completedChildIds.has(c.id));
  const borderColor = allCompleted
    ? "border-success-400"
    : statusColors[lesson.status] || "border-light";

  const hasDetails = lesson.description || lesson.resources.length > 0;

  return (
    <div className={`rounded-xl border-2 bg-surface p-3 ${borderColor}`}>
      <Link href={`/lessons/${lesson.id}`} className="block hover:text-interactive">
        <h4 className="text-sm font-medium text-primary line-clamp-2">
          {lesson.title}
        </h4>
      </Link>
      <div className="mt-1.5 flex items-center gap-2">
        <Badge variant={statusBadge[lesson.status] || "default"}>
          {lesson.status === "in_progress"
            ? "In Progress"
            : lesson.status.charAt(0).toUpperCase() + lesson.status.slice(1)}
        </Badge>
        {lesson.planned_date && (
          <span className="text-[10px] text-muted">
            {new Date(lesson.planned_date + "T00:00:00").toLocaleDateString(
              undefined,
              { month: "short", day: "numeric" },
            )}
          </span>
        )}
      </div>
      {hasDetails && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1 text-[10px] text-muted hover:text-interactive"
        >
          {lesson.resources.length > 0
            ? `${lesson.resources.length} resource${lesson.resources.length !== 1 ? "s" : ""}${lesson.description ? " + details" : ""}`
            : "Show details"}
          {" \u25BC"}
        </button>
      )}
      {expanded && (
        <div className="mt-2 space-y-2">
          {lesson.description && (
            <p className="text-xs text-muted">{lesson.description}</p>
          )}
          {lesson.resources.length > 0 && (
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
          )}
          <button
            type="button"
            onClick={() => setExpanded(false)}
            className="text-[10px] text-muted hover:text-interactive"
          >
            {"\u25B2 Collapse"}
          </button>
        </div>
      )}
      {assignedChildren.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {assignedChildren.map((child) => {
            const completion = lesson.completions.find(
              (c) => c.child_id === child.id,
            );
            return (
              <CompletionCheckbox
                key={child.id}
                lessonId={lesson.id}
                child={child}
                completed={!!completion}
                grade={completion?.grade ?? null}
                isPending={isPending}
                onToggle={onCompletionToggle}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SectionColumn({
  sectionName,
  lessons,
  subjectColor,
  assignedChildren,
  isPending,
  onCompletionToggle,
}: {
  sectionName: string;
  lessons: Lesson[];
  subjectColor: string | null;
  assignedChildren: Child[];
  isPending: boolean;
  onCompletionToggle: (lessonId: string, childId: string, shouldComplete: boolean) => void;
}) {
  return (
    <div
      className="w-72 flex-shrink-0 rounded-2xl border border-light bg-surface-muted shadow-warm"
      style={{ scrollSnapAlign: "start" }}
    >
      {/* Color bar */}
      <div
        className="h-1.5 rounded-t-[10px]"
        style={{ backgroundColor: subjectColor || "#6366f1" }}
      />
      {/* Section header */}
      <div className="border-b bg-surface px-4 py-3 rounded-t-none">
        <h3 className="text-sm font-semibold text-primary">{sectionName}</h3>
        <p className="text-xs text-muted">{lessons.length} lessons</p>
      </div>
      {/* Stacked lesson cards */}
      <div className="space-y-2 overflow-y-auto p-3" style={{ maxHeight: "70vh" }}>
        {lessons.map((lesson) => (
          <LessonMiniCard
            key={lesson.id}
            lesson={lesson}
            assignedChildren={assignedChildren}
            isPending={isPending}
            onCompletionToggle={onCompletionToggle}
          />
        ))}
      </div>
    </div>
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
    shouldComplete: boolean,
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
      const group =
        r.type === "book"
          ? "Books"
          : r.type === "video"
            ? "Videos"
            : r.type === "supply"
              ? "Supplies"
              : "Other";
      if (!acc[group]) acc[group] = [];
      acc[group].push(r);
      return acc;
    },
    {} as Record<string, CurriculumResource[]>,
  );

  const hasResources = curriculumResources.length > 0;

  // Check if lessons use sections — if so, render section-grouped view
  const hasSections = lessons.some((l) => l.section);

  if (hasSections) {
    const sectionOrder: string[] = [];
    const sectionMap = new Map<string, Lesson[]>();
    const unsectioned: Lesson[] = [];

    for (const lesson of lessons) {
      const key = lesson.section || "";
      if (!key) {
        unsectioned.push(lesson);
        continue;
      }
      if (!sectionMap.has(key)) {
        sectionOrder.push(key);
        sectionMap.set(key, []);
      }
      sectionMap.get(key)!.push(lesson);
    }

    return (
      <div className="relative">
        {isPending && (
          <div className="absolute right-0 top-0 z-10 rounded-lg bg-interactive-light px-3 py-1 text-xs font-medium text-interactive animate-pulse">
            Saving...
          </div>
        )}

        <div
          className="flex gap-4 overflow-x-auto pb-4"
          style={{ scrollSnapType: "x mandatory" }}
        >
          {/* Resources Column */}
          {hasResources && (
            <div
              className="w-64 flex-shrink-0 rounded-2xl border border-light bg-surface-muted shadow-warm"
              style={{ scrollSnapAlign: "start" }}
            >
              <div className="border-b bg-surface px-4 py-3 rounded-t-2xl">
                <h3 className="text-sm font-semibold text-primary">
                  Curriculum Resources
                </h3>
                <p className="text-xs text-muted">
                  {curriculumResources.length} shared
                </p>
              </div>
              <div className="space-y-4 p-3">
                {Object.entries(resourcesByType).map(([group, resources]) => (
                  <div key={group}>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
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
                            className="flex items-center gap-2 rounded-lg border border-light bg-surface p-2 text-xs transition-colors hover:border-primary-200"
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
                              <p className="truncate font-medium text-secondary">
                                {r.title}
                              </p>
                              {r.description && (
                                <p className="truncate text-[10px] text-muted">
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

          {/* Section columns */}
          {sectionOrder.map((sectionName) => (
            <SectionColumn
              key={sectionName}
              sectionName={sectionName}
              lessons={sectionMap.get(sectionName)!}
              subjectColor={subjectColor}
              assignedChildren={assignedChildren}
              isPending={isPending}
              onCompletionToggle={handleCompletionToggle}
            />
          ))}

          {/* Unsectioned lessons */}
          {unsectioned.length > 0 && (
            <SectionColumn
              sectionName="Other"
              lessons={unsectioned}
              subjectColor={subjectColor}
              assignedChildren={assignedChildren}
              isPending={isPending}
              onCompletionToggle={handleCompletionToggle}
            />
          )}

          {/* Empty state */}
          {lessons.length === 0 && (
            <div className="flex w-full items-center justify-center py-16 text-sm text-muted">
              No lessons in this curriculum yet.
            </div>
          )}
        </div>
      </div>
    );
  }

  // Fall back to existing per-lesson column layout
  return (
    <div className="relative">
      {/* Saving indicator */}
      {isPending && (
        <div className="absolute right-0 top-0 z-10 rounded-lg bg-interactive-light px-3 py-1 text-xs font-medium text-interactive animate-pulse">
          Saving...
        </div>
      )}

      {/* Horizontal scroll container */}
      <div
        className="flex gap-4 overflow-x-auto pb-4"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {/* Resources Column (fixed left) */}
        {hasResources && (
          <div
            className="w-64 flex-shrink-0 rounded-2xl border border-light bg-surface-muted shadow-warm"
            style={{ scrollSnapAlign: "start" }}
          >
            <div className="border-b bg-surface px-4 py-3 rounded-t-2xl">
              <h3 className="text-sm font-semibold text-primary">
                Curriculum Resources
              </h3>
              <p className="text-xs text-muted">
                {curriculumResources.length} shared
              </p>
            </div>
            <div className="space-y-4 p-3">
              {Object.entries(resourcesByType).map(([group, resources]) => (
                <div key={group}>
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
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
                          className="flex items-center gap-2 rounded-lg border border-light bg-surface p-2 text-xs transition-colors hover:border-primary-200"
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
                            <p className="truncate font-medium text-secondary">
                              {r.title}
                            </p>
                            {r.description && (
                              <p className="truncate text-[10px] text-muted">
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
            lesson.completions.map((c) => c.child_id),
          );
          const allCompleted =
            assignedChildren.length > 0 &&
            assignedChildren.every((c) => completedChildIds.has(c.id));
          const borderColor = allCompleted
            ? "border-success-400"
            : statusColors[lesson.status] || "border-light";

          return (
            <div
              key={lesson.id}
              className={`w-64 flex-shrink-0 rounded-2xl border-2 bg-surface shadow-warm transition-shadow hover:shadow-warm-md ${borderColor}`}
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
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Lesson {idx + 1}
                  </span>
                  <Badge variant={statusBadge[lesson.status] || "default"}>
                    {lesson.status === "in_progress"
                      ? "In Progress"
                      : lesson.status.charAt(0).toUpperCase() +
                        lesson.status.slice(1)}
                  </Badge>
                </div>
                {lesson.planned_date && (
                  <p className="mt-0.5 text-xs text-muted">
                    {new Date(
                      lesson.planned_date + "T00:00:00",
                    ).toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                )}
              </div>

              {/* Title & description — clickable to lesson detail */}
              <Link
                href={`/lessons/${lesson.id}`}
                className="block px-4 py-3 transition-colors hover:bg-surface-muted"
              >
                <h4 className="text-sm font-semibold text-primary line-clamp-2">
                  {lesson.title}
                </h4>
                {lesson.description && (
                  <p className="mt-1 text-xs text-muted line-clamp-2">
                    {lesson.description}
                  </p>
                )}
                {lesson.estimated_duration && (
                  <p className="mt-1 text-[10px] text-muted">
                    ~{lesson.estimated_duration} min
                  </p>
                )}
              </Link>

              {/* Resources */}
              {lesson.resources.length > 0 && (
                <div className="border-t px-3 py-2">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
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
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted">
                    Completion
                  </p>
                  <div className="space-y-1">
                    {assignedChildren.map((child) => {
                      const completion = lesson.completions.find(
                        (c) => c.child_id === child.id,
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
          <div className="flex w-full items-center justify-center py-16 text-sm text-muted">
            No lessons in this curriculum yet.
          </div>
        )}
      </div>
    </div>
  );
}
