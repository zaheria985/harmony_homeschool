"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Badge from "@/components/ui/Badge";
import RowActions from "@/components/ui/RowActions";
import LessonFormModal from "@/components/lessons/LessonFormModal";
import { updateLessonStatus, createLesson, deleteLesson, reorderLessons } from "@/lib/actions/lessons";
import { markLessonComplete } from "@/lib/actions/completions";
import { canEdit, canMarkComplete } from "@/lib/permissions";
import CardViewModal from "@/components/curricula/CardViewModal";
import ResourcePreviewModal from "@/components/ui/ResourcePreviewModal";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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
  permissionLevel?: string;
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
  onPreview,
}: {
  type: string;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  onPreview?: () => void;
}) {
  const cfg = typeConfig[type] || typeConfig.url;
  const displayTitle = title || "Untitled";
  const youtubeId = extractYoutubeId(url);

  const isImageUrl = /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
  const thumbnail = youtubeId
    ? `https://img.youtube.com/vi/${youtubeId}/mqdefault.jpg`
    : thumbnailUrl || (isImageUrl ? url : null);

  const inner = (
    <>
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
    </>
  );

  if (onPreview) {
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onPreview(); }}
        className="group flex w-full items-center gap-2 rounded-lg border border-light bg-surface p-2 text-xs text-left transition-colors hover:border-primary-200 hover:bg-interactive-light/30"
      >
        {inner}
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-center gap-2 rounded-lg border border-light bg-surface p-2 text-xs transition-colors hover:border-primary-200 hover:bg-interactive-light/30"
      onClick={(e) => e.stopPropagation()}
    >
      {inner}
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

function isImageResource(r: LessonResource): boolean {
  const t = r.global_type || r.type;
  if (t === "youtube" || t === "video") return false;
  const thumb = r.global_thumbnail_url || r.thumbnail_url;
  if (thumb) return /\.(jpg|jpeg|png|gif|webp)/i.test(thumb);
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(r.url);
}

function getResourceImageUrl(r: LessonResource): string {
  const thumb = r.global_thumbnail_url || r.thumbnail_url;
  if (thumb) return thumb;
  return r.url;
}

function LessonMiniCard({
  lesson,
  assignedChildren,
  isPending,
  onCompletionToggle,
  showCompletions = true,
  onView,
  onEdit,
  onDeleteLesson,
  showActions = false,
  onTitleClick,
  onResourcePreview,
}: {
  lesson: Lesson;
  assignedChildren: Child[];
  isPending: boolean;
  onCompletionToggle: (lessonId: string, childId: string, shouldComplete: boolean) => void;
  showCompletions?: boolean;
  onView?: () => void;
  onEdit?: () => void;
  onDeleteLesson?: () => void;
  showActions?: boolean;
  onTitleClick?: () => void;
  onResourcePreview?: (resource: { title: string; type: string; url: string; thumbnailUrl: string | null }) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const completedChildIds = new Set(lesson.completions.map((c) => c.child_id));
  const allCompleted =
    assignedChildren.length > 0 &&
    assignedChildren.every((c) => completedChildIds.has(c.id));
  const borderColor = allCompleted
    ? "border-success-400"
    : statusColors[lesson.status] || "border-light";

  // Find cover image (first image-type resource)
  const coverResource = lesson.resources.find((r) => isImageResource(r)) || null;
  const otherResources = lesson.resources.filter((r) => r !== coverResource);

  // Split remaining resources into images vs non-images
  const otherImages = otherResources.filter((r) => isImageResource(r));
  const nonImageResources = otherResources.filter((r) => !isImageResource(r));

  const hasExpandableDetails = lesson.description || nonImageResources.length > 0;

  return (
    <div className={`rounded-xl border-2 bg-surface overflow-hidden ${borderColor}`}>
      {/* Cover image — full-width at top */}
      {coverResource && (
        <a
          href={coverResource.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={getResourceImageUrl(coverResource)}
            alt={coverResource.title || ""}
            className="w-full"
          />
        </a>
      )}

      <div className="p-3">
        <div className="flex items-start justify-between gap-1">
          <button
            type="button"
            onClick={onTitleClick}
            className="block hover:text-interactive min-w-0 flex-1 text-left"
          >
            <h4 className="text-sm font-medium text-primary line-clamp-2">
              {lesson.title}
            </h4>
          </button>
          {showActions && (
            <RowActions
              onView={onView}
              onEdit={onEdit}
              onDelete={onDeleteLesson}
            />
          )}
        </div>
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

        {/* Other image resources — displayed larger, always visible */}
        {otherImages.length > 0 && (
          <div className="mt-2 space-y-2">
            {otherImages.map((r) => (
              <a
                key={r.id}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
                onClick={(e) => e.stopPropagation()}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={getResourceImageUrl(r)}
                  alt={r.title || ""}
                  className="w-full rounded-lg"
                />
              </a>
            ))}
          </div>
        )}

        {/* Non-image resources — compact cards, always visible */}
        {nonImageResources.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {nonImageResources.slice(0, expanded ? undefined : 2).map((r) => {
              const rType = r.global_type || r.type;
              const isVideo = rType === "youtube" || rType === "video";
              return (
                <ResourceMiniCard
                  key={r.id}
                  type={rType}
                  url={r.url}
                  title={r.title}
                  thumbnailUrl={r.global_thumbnail_url || r.thumbnail_url}
                  onPreview={isVideo && onResourcePreview ? () => onResourcePreview({
                    title: r.title || "Untitled", type: rType, url: r.url,
                    thumbnailUrl: r.global_thumbnail_url || r.thumbnail_url,
                  }) : undefined}
                />
              );
            })}
          </div>
        )}

        {/* Expand/collapse for description + extra non-image resources */}
        {hasExpandableDetails && !expanded && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-1 text-[10px] text-muted hover:text-interactive"
          >
            {nonImageResources.length > 2
              ? `+${nonImageResources.length - 2} more`
              : lesson.description
                ? "Show details"
                : ""}
            {(nonImageResources.length > 2 || lesson.description) && " \u25BC"}
          </button>
        )}
        {expanded && (
          <div className="mt-2 space-y-2">
            {lesson.description && (
              <p className="text-xs text-muted">{lesson.description}</p>
            )}
            {nonImageResources.length > 2 && (
              <div className="space-y-1.5">
                {nonImageResources.slice(2).map((r) => {
                  const rType = r.global_type || r.type;
                  const isVideo = rType === "youtube" || rType === "video";
                  return (
                    <ResourceMiniCard
                      key={r.id}
                      type={rType}
                      url={r.url}
                      title={r.title}
                      thumbnailUrl={r.global_thumbnail_url || r.thumbnail_url}
                      onPreview={isVideo && onResourcePreview ? () => onResourcePreview({
                        title: r.title || "Untitled", type: rType, url: r.url,
                        thumbnailUrl: r.global_thumbnail_url || r.thumbnail_url,
                      }) : undefined}
                    />
                  );
                })}
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

        {showCompletions && assignedChildren.length > 0 && (
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
    </div>
  );
}

function SortableLessonCard({
  id,
  children,
}: {
  id: string;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
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
  isAddingHere,
  newLessonTitle,
  onNewLessonTitleChange,
  onAddClick,
  onSave,
  onCancel,
  isSaving,
  showAddLesson = true,
  showCompletions = true,
  showActions = false,
  onViewLesson,
  onEditLesson,
  onDeleteLesson,
  onTitleClick,
  onResourcePreview,
}: {
  sectionName: string;
  lessons: Lesson[];
  subjectColor: string | null;
  assignedChildren: Child[];
  isPending: boolean;
  onCompletionToggle: (lessonId: string, childId: string, shouldComplete: boolean) => void;
  isAddingHere: boolean;
  newLessonTitle: string;
  onNewLessonTitleChange: (value: string) => void;
  onAddClick: () => void;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  showAddLesson?: boolean;
  showCompletions?: boolean;
  showActions?: boolean;
  onViewLesson?: (lessonId: string) => void;
  onEditLesson?: (lesson: Lesson) => void;
  onDeleteLesson?: (lessonId: string) => void;
  onTitleClick?: (lesson: Lesson) => void;
  onResourcePreview?: (resource: { title: string; type: string; url: string; thumbnailUrl: string | null }) => void;
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
        <p className="text-xs text-muted">{lessons.length} cards</p>
      </div>
      {/* Stacked lesson cards */}
      <SortableContext items={lessons.map((l) => l.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2 overflow-y-auto p-3" style={{ maxHeight: "70vh" }}>
          {lessons.map((lesson) => (
            <SortableLessonCard key={lesson.id} id={lesson.id}>
              <LessonMiniCard
                lesson={lesson}
                assignedChildren={assignedChildren}
                isPending={isPending}
                onCompletionToggle={onCompletionToggle}
                showCompletions={showCompletions}
                showActions={showActions}
                onView={onViewLesson ? () => onViewLesson(lesson.id) : undefined}
                onEdit={onEditLesson ? () => onEditLesson(lesson) : undefined}
                onDeleteLesson={onDeleteLesson ? () => onDeleteLesson(lesson.id) : undefined}
                onTitleClick={onTitleClick ? () => onTitleClick(lesson) : undefined}
                onResourcePreview={onResourcePreview}
              />
            </SortableLessonCard>
          ))}

        </div>
      </SortableContext>

      {/* Inline add form or button — outside SortableContext */}
      <div className="px-3 pb-3">
        {showAddLesson && (isAddingHere ? (
          <div className="rounded-xl border border-light bg-surface p-3 space-y-2">
            <input
              type="text"
              value={newLessonTitle}
              onChange={(e) => onNewLessonTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newLessonTitle.trim()) onSave();
                if (e.key === "Escape") onCancel();
              }}
              placeholder="Card title..."
              autoFocus
              disabled={isSaving}
              className="w-full rounded-lg border border-light bg-surface px-3 py-1.5 text-sm text-primary placeholder:text-muted focus:border-interactive focus:outline-none focus:ring-1 focus:ring-focus disabled:opacity-50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onSave}
                disabled={!newLessonTitle.trim() || isSaving}
                className="rounded-lg bg-interactive px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-interactive-hover disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={isSaving}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-secondary disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onAddClick}
            className="w-full rounded-lg border border-dashed border-light px-3 py-2 text-sm text-muted hover:bg-surface-muted hover:text-secondary transition-colors"
          >
            + Add Card
          </button>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// Main Board Component
// ============================================================================

type FilterOption = "all" | "incomplete" | "completed";

function StatusFilterBar({
  filter,
  onFilterChange,
  totalCount,
  completedCount,
  incompleteCount,
}: {
  filter: FilterOption;
  onFilterChange: (f: FilterOption) => void;
  totalCount: number;
  completedCount: number;
  incompleteCount: number;
}) {
  const tabs: { key: FilterOption; label: string; count: number }[] = [
    { key: "all", label: "All", count: totalCount },
    { key: "incomplete", label: "Incomplete", count: incompleteCount },
    { key: "completed", label: "Completed", count: completedCount },
  ];

  return (
    <div className="mb-4 flex gap-1 rounded-lg bg-surface-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => onFilterChange(tab.key)}
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
  );
}

export default function CurriculumBoard({
  curriculumId,
  subjectColor,
  lessons,
  children: assignedChildren,
  curriculumResources,
  permissionLevel = "full",
}: BoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const showAddLesson = canEdit(permissionLevel);
  const showCompletions = canMarkComplete(permissionLevel);
  const [addingToSection, setAddingToSection] = useState<string | null>(null);
  const [newLessonTitle, setNewLessonTitle] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState<FilterOption>("all");
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [viewingLesson, setViewingLesson] = useState<Lesson | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [localLessons, setLocalLessons] = useState<Lesson[]>(lessons);
  const [previewResource, setPreviewResource] = useState<{
    title: string; type: string; url: string; thumbnailUrl: string | null;
  } | null>(null);
  const showRowActions = canEdit(permissionLevel);

  // Sync localLessons when server data changes
  useEffect(() => {
    setLocalLessons(lessons);
  }, [lessons]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  const completedCount = lessons.filter((l) => {
    const completedChildIds = new Set(l.completions.map((c) => c.child_id));
    return assignedChildren.length > 0 && assignedChildren.every((c) => completedChildIds.has(c.id));
  }).length;
  const incompleteCount = lessons.length - completedCount;

  const filteredLessons =
    statusFilter === "all"
      ? lessons
      : statusFilter === "completed"
        ? lessons.filter((l) => {
            const completedChildIds = new Set(l.completions.map((c) => c.child_id));
            return assignedChildren.length > 0 && assignedChildren.every((c) => completedChildIds.has(c.id));
          })
        : lessons.filter((l) => {
            const completedChildIds = new Set(l.completions.map((c) => c.child_id));
            return !(assignedChildren.length > 0 && assignedChildren.every((c) => completedChildIds.has(c.id)));
          });

  async function handleAddLesson(sectionName: string) {
    if (!newLessonTitle.trim()) return;
    setIsSaving(true);
    try {
      const fd = new FormData();
      fd.set("title", newLessonTitle.trim());
      fd.set("curriculum_id", curriculumId);
      fd.set("section", sectionName);
      await createLesson(fd);
      setNewLessonTitle("");
      setAddingToSection(null);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

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

  function handleViewLesson(lessonId: string) {
    router.push(`/lessons/${lessonId}`);
  }

  async function handleDeleteLesson(lessonId: string) {
    await deleteLesson(lessonId);
    router.refresh();
  }

  // --- DnD handlers ---
  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find which section the active and over items belong to
    const activeLesson = localLessons.find((l) => l.id === activeId);
    const overLesson = localLessons.find((l) => l.id === overId);

    if (!activeLesson) return;

    // Determine target section: if over a lesson, use that lesson's section; if over a section container, use that
    const activeSection = activeLesson.section || "";
    const overSection = overLesson ? (overLesson.section || "") : (overId.startsWith("section:") ? overId.slice(8) : activeSection);

    if (activeSection === overSection) return;

    // Move card to new section optimistically
    setLocalLessons((prev) =>
      prev.map((l) =>
        l.id === activeId ? { ...l, section: overSection || null } : l
      )
    );
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragId(null);

    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Compute final section assignments and order
    const updated = [...localLessons];

    // Find active lesson and determine its target section
    const activeIdx = updated.findIndex((l) => l.id === activeId);
    if (activeIdx === -1) return;

    const overLesson = updated.find((l) => l.id === overId);
    const targetSection = overLesson
      ? (overLesson.section || "")
      : updated[activeIdx].section || "";

    // If dropping on a different lesson, reorder within that section
    if (overLesson && activeId !== overId) {
      const activeLesson = updated.splice(activeIdx, 1)[0];
      activeLesson.section = targetSection || null;
      const overIdx = updated.findIndex((l) => l.id === overId);
      updated.splice(overIdx, 0, activeLesson);
    }

    setLocalLessons(updated);

    // Build updates for server: only lessons that have sections
    const sectionLessons = updated.filter((l) => l.section != null || lessons.some((orig) => orig.id === l.id && orig.section != null));
    const updates = sectionLessons.map((l, i) => ({
      id: l.id,
      order_index: i,
      section: l.section,
    }));

    if (updates.length > 0) {
      startTransition(async () => {
        await reorderLessons(updates);
        router.refresh();
      });
    }
  }

  const activeDragLesson = activeDragId
    ? localLessons.find((l) => l.id === activeDragId) || null
    : null;

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
    // Use localLessons for DnD optimistic state, applying the same status filter
    const dndFilteredLessons =
      statusFilter === "all"
        ? localLessons
        : statusFilter === "completed"
          ? localLessons.filter((l) => {
              const cIds = new Set(l.completions.map((c) => c.child_id));
              return assignedChildren.length > 0 && assignedChildren.every((c) => cIds.has(c.id));
            })
          : localLessons.filter((l) => {
              const cIds = new Set(l.completions.map((c) => c.child_id));
              return !(assignedChildren.length > 0 && assignedChildren.every((c) => cIds.has(c.id)));
            });

    const sectionOrder: string[] = [];
    const sectionMap = new Map<string, Lesson[]>();
    const unsectioned: Lesson[] = [];

    for (const lesson of dndFilteredLessons) {
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

        <StatusFilterBar
          filter={statusFilter}
          onFilterChange={setStatusFilter}
          totalCount={lessons.length}
          completedCount={completedCount}
          incompleteCount={incompleteCount}
        />

        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
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
                isAddingHere={addingToSection === sectionName}
                newLessonTitle={addingToSection === sectionName ? newLessonTitle : ""}
                onNewLessonTitleChange={setNewLessonTitle}
                onAddClick={() => { setAddingToSection(sectionName); setNewLessonTitle(""); }}
                onSave={() => handleAddLesson(sectionName)}
                onCancel={() => { setAddingToSection(null); setNewLessonTitle(""); }}
                isSaving={isSaving}
                showAddLesson={showAddLesson}
                showCompletions={showCompletions}
                showActions={showRowActions}
                onViewLesson={handleViewLesson}
                onEditLesson={setEditingLesson}
                onDeleteLesson={handleDeleteLesson}
                onTitleClick={setViewingLesson}
                onResourcePreview={setPreviewResource}
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
                isAddingHere={addingToSection === "Other"}
                newLessonTitle={addingToSection === "Other" ? newLessonTitle : ""}
                onNewLessonTitleChange={setNewLessonTitle}
                onAddClick={() => { setAddingToSection("Other"); setNewLessonTitle(""); }}
                onSave={() => handleAddLesson("Other")}
                onCancel={() => { setAddingToSection(null); setNewLessonTitle(""); }}
                isSaving={isSaving}
                showAddLesson={showAddLesson}
                showCompletions={showCompletions}
                showActions={showRowActions}
                onViewLesson={handleViewLesson}
                onEditLesson={setEditingLesson}
                onDeleteLesson={handleDeleteLesson}
                onTitleClick={setViewingLesson}
                onResourcePreview={setPreviewResource}
              />
            )}

            {/* Empty state */}
            {dndFilteredLessons.length === 0 && (
              <div className="flex w-full items-center justify-center py-16 text-sm text-muted">
                {statusFilter === "all" ? "No cards in this curriculum yet." : `No ${statusFilter} cards.`}
              </div>
            )}
          </div>

          <DragOverlay>
            {activeDragLesson && (
              <div className="w-72 opacity-90">
                <LessonMiniCard
                  lesson={activeDragLesson}
                  assignedChildren={assignedChildren}
                  isPending={false}
                  onCompletionToggle={() => {}}
                  showCompletions={false}
                  showActions={false}
                />
              </div>
            )}
          </DragOverlay>
        </DndContext>

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
                }
              : null
          }
          children={assignedChildren}
        />

        <CardViewModal
          lesson={viewingLesson}
          onClose={() => setViewingLesson(null)}
        />

        <ResourcePreviewModal
          open={!!previewResource}
          onClose={() => setPreviewResource(null)}
          title={previewResource?.title || ""}
          type={previewResource?.type || ""}
          url={previewResource?.url || null}
          thumbnailUrl={previewResource?.thumbnailUrl}
        />
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

      <StatusFilterBar
        filter={statusFilter}
        onFilterChange={setStatusFilter}
        totalCount={lessons.length}
        completedCount={completedCount}
        incompleteCount={incompleteCount}
      />

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
        {filteredLessons.map((lesson, idx) => {
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
                    Card {idx + 1}
                  </span>
                  <div className="flex items-center gap-1">
                    <Badge variant={statusBadge[lesson.status] || "default"}>
                      {lesson.status === "in_progress"
                        ? "In Progress"
                        : lesson.status.charAt(0).toUpperCase() +
                          lesson.status.slice(1)}
                    </Badge>
                    {showRowActions && (
                      <RowActions
                        onView={() => handleViewLesson(lesson.id)}
                        onEdit={() => setEditingLesson(lesson)}
                        onDelete={() => handleDeleteLesson(lesson.id)}
                      />
                    )}
                  </div>
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

              {/* Title & description — clickable to open card view modal */}
              <button
                type="button"
                onClick={() => setViewingLesson(lesson)}
                className="block w-full text-left px-4 py-3 transition-colors hover:bg-surface-muted"
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
              </button>

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
              {showCompletions && assignedChildren.length > 0 && (
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
        {filteredLessons.length === 0 && (
          <div className="flex w-full items-center justify-center py-16 text-sm text-muted">
            {statusFilter === "all" ? "No cards in this curriculum yet." : `No ${statusFilter} cards.`}
          </div>
        )}
      </div>

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
              }
            : null
        }
        children={assignedChildren}
      />

      <CardViewModal
        lesson={viewingLesson}
        onClose={() => setViewingLesson(null)}
      />

      <ResourcePreviewModal
        open={!!previewResource}
        onClose={() => setPreviewResource(null)}
        title={previewResource?.title || ""}
        type={previewResource?.type || ""}
        url={previewResource?.url || null}
        thumbnailUrl={previewResource?.thumbnailUrl}
      />
    </div>
  );
}
