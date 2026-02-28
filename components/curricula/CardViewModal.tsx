"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import MarkdownContent from "@/components/ui/MarkdownContent";
import ResourcePreviewModal from "@/components/ui/ResourcePreviewModal";
import InteractiveChecklist, { parseChecklist } from "@/components/lessons/InteractiveChecklist";
import LessonCardModal from "@/components/curricula/LessonCardModal";
import { attachResourceToLessons } from "@/lib/actions/resources";
import { suggestResources } from "@/lib/actions/ai";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createLessonCard, deleteLessonCard, reorderLessonCards } from "@/lib/actions/lesson-cards";

type CurriculumResource = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
};

type AISuggestion = {
  title: string;
  type: string;
  description: string;
};

type LessonCardItem = {
  id: string;
  lesson_id: string;
  card_type: string;
  title: string | null;
  content: string | null;
  url: string | null;
  thumbnail_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  resource_id: string | null;
  resource_title: string | null;
  resource_type: string | null;
  resource_url: string | null;
  resource_thumbnail_url: string | null;
  order_index: number;
};

type CardViewModalProps = {
  lesson: {
    id: string;
    title: string;
    description: string | null;
    checklist_state?: Record<string, boolean>;
    resources: {
      id: string;
      type: string;
      url: string;
      title: string | null;
      thumbnail_url: string | null;
      global_type: string | null;
      global_thumbnail_url: string | null;
      resource_id?: string | null;
    }[];
    cards?: LessonCardItem[];
  } | null;
  curriculumResources?: CurriculumResource[];
  subjectName?: string;
  curriculumName?: string;
  onClose: () => void;
};

const typeConfig: Record<string, { icon: string; bg: string }> = {
  youtube: { icon: "\u25B6", bg: "from-red-50 to-red-100" },
  video: { icon: "\uD83C\uDFAC", bg: "from-red-50 to-red-100" },
  pdf: { icon: "\uD83D\uDCC4", bg: "from-amber-50 to-orange-100" },
  filerun: { icon: "\uD83D\uDCC1", bg: "from-blue-50 to-blue-100" },
  url: { icon: "\uD83D\uDD17", bg: "from-cyan-50 to-blue-100" },
  link: { icon: "\uD83D\uDD17", bg: "from-cyan-50 to-blue-100" },
  book: { icon: "\uD83D\uDCD5", bg: "from-indigo-50 to-purple-100" },
  supply: { icon: "\uD83E\uDDF0", bg: "from-gray-50 to-slate-100" },
};

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  );
  return match ? match[1] : null;
}

function ResourceCard({
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

  // YouTube: full-width thumbnail, title below
  if (youtubeId && thumbnail) {
    const handleClick = onPreview || undefined;
    if (handleClick) {
      return (
        <button
          type="button"
          onClick={handleClick}
          className="group block w-full overflow-hidden rounded-lg border border-light bg-surface text-left transition-colors hover:border-primary-200 hover:bg-interactive-light/30"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbnail} alt="" className="w-full object-cover" />
          <div className="flex items-center gap-2 px-3 py-2">
            <span className="text-sm text-red-500">▶</span>
            <span className="min-w-0 truncate text-sm text-secondary group-hover:text-interactive">{displayTitle}</span>
          </div>
        </button>
      );
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-full overflow-hidden rounded-lg border border-light bg-surface transition-colors hover:border-primary-200 hover:bg-interactive-light/30"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={thumbnail} alt="" className="w-full object-cover" />
        <div className="flex items-center gap-2 px-3 py-2">
          <span className="text-sm text-red-500">▶</span>
          <span className="min-w-0 truncate text-sm text-secondary group-hover:text-interactive">{displayTitle}</span>
        </div>
      </a>
    );
  }

  // Non-YouTube: compact horizontal layout
  if (onPreview) {
    return (
      <button
        type="button"
        onClick={onPreview}
        className="group flex w-full items-center gap-3 rounded-lg border border-light bg-surface p-3 text-sm text-left transition-colors hover:border-primary-200 hover:bg-interactive-light/30"
      >
        {thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="h-10 w-16 flex-shrink-0 rounded object-cover"
          />
        ) : (
          <span
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${cfg.bg} text-base`}
          >
            {cfg.icon}
          </span>
        )}
        <span className="min-w-0 truncate text-secondary group-hover:text-interactive">
          {displayTitle}
        </span>
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex w-full items-center gap-3 rounded-lg border border-light bg-surface p-3 text-sm transition-colors hover:border-primary-200 hover:bg-interactive-light/30"
    >
      {thumbnail ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbnail}
          alt=""
          className="h-10 w-16 flex-shrink-0 rounded object-cover"
        />
      ) : (
        <span
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${cfg.bg} text-base`}
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

function AddLessonCardForm({ lessonId }: { lessonId: string }) {
  const [isAdding, setIsAdding] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  if (!isAdding) {
    return (
      <button
        type="button"
        onClick={() => setIsAdding(true)}
        className="w-full rounded-lg border border-dashed border-light px-3 py-2 text-xs text-muted hover:border-primary-200 hover:text-interactive transition-colors"
      >
        + Add lesson card
      </button>
    );
  }

  async function handleSave() {
    if (!url.trim() && !title.trim()) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.set("lesson_id", lessonId);
      if (url.trim()) fd.set("url", url.trim());
      if (title.trim()) fd.set("title", title.trim());
      await createLessonCard(fd);
      setUrl("");
      setTitle("");
      setIsAdding(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-light bg-surface p-3 space-y-2">
      <input
        type="text"
        placeholder="Title (optional if URL provided)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-md border border-light bg-surface px-2 py-1.5 text-sm text-primary placeholder:text-muted focus:border-interactive focus:ring-1 focus:ring-focus"
      />
      <input
        type="text"
        placeholder="URL (YouTube, link, etc.)"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
        className="w-full rounded-md border border-light bg-surface px-2 py-1.5 text-sm text-primary placeholder:text-muted focus:border-interactive focus:ring-1 focus:ring-focus"
        autoFocus
      />
      <div className="flex gap-2 justify-end">
        <button
          type="button"
          onClick={() => { setIsAdding(false); setUrl(""); setTitle(""); }}
          className="rounded-md px-2 py-1 text-xs text-muted hover:text-primary"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (!url.trim() && !title.trim())}
          className="rounded-md bg-interactive px-3 py-1 text-xs font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Add"}
        </button>
      </div>
    </div>
  );
}

function SortableLessonCardWrapper({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  return (
    <div ref={setNodeRef} style={style} className="flex items-start gap-2">
      <button type="button" {...attributes} {...listeners} className="mt-3 flex-shrink-0 cursor-grab text-muted hover:text-secondary active:cursor-grabbing" title="Drag to reorder">
        ⠿
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function CardViewModal({ lesson, curriculumResources = [], subjectName = "General", curriculumName, onClose }: CardViewModalProps) {
  const [previewResource, setPreviewResource] = useState<{
    title: string;
    type: string;
    url: string;
    thumbnailUrl: string | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recentlyAttached, setRecentlyAttached] = useState<Set<string>>(new Set());
  const [aiSuggestions, setAiSuggestions] = useState<AISuggestion[]>([]);
  const [suggestingResources, setSuggestingResources] = useState(false);
  const [aiError, setAiError] = useState("");
  const [openLessonCard, setOpenLessonCard] = useState<{
    card: LessonCardItem;
    allCards: LessonCardItem[];
  } | null>(null);
  const router = useRouter();
  const cardSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  function handleCardDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const cards = lesson?.cards || [];
    const oldIndex = cards.findIndex((c) => c.id === active.id);
    const newIndex = cards.findIndex((c) => c.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...cards];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    const updates = reordered.map((c, i) => ({ id: c.id, order_index: i }));
    startTransition(async () => {
      await reorderLessonCards(updates);
      router.refresh();
    });
  }

  // Filter curriculum resources to only show those NOT already attached to this lesson
  const attachedResourceIds = new Set(
    (lesson?.resources || [])
      .map((r) => r.resource_id)
      .filter(Boolean) as string[],
  );
  const unattachedCurriculumResources = curriculumResources.filter(
    (cr) => !attachedResourceIds.has(cr.id) && !recentlyAttached.has(cr.id),
  );

  function handleAttachCurriculumResource(resourceId: string) {
    if (!lesson) return;
    startTransition(async () => {
      const result = await attachResourceToLessons(resourceId, [lesson.id]);
      if (result && "success" in result) {
        setRecentlyAttached((prev) => new Set(prev).add(resourceId));
      }
    });
  }

  async function handleSuggestResources() {
    if (!lesson) return;
    setSuggestingResources(true);
    setAiError("");
    try {
      const fd = new FormData();
      fd.set("lessonTitle", lesson.title);
      fd.set("subject", subjectName);
      const result = await suggestResources(fd);
      if ("error" in result) {
        setAiError(result.error);
      } else {
        setAiSuggestions(result.suggestions);
      }
    } catch {
      setAiError("Failed to get suggestions");
    } finally {
      setSuggestingResources(false);
    }
  }

  return (
    <Modal
      open={!!lesson}
      onClose={() => {
        setRecentlyAttached(new Set());
        setAiSuggestions([]);
        setAiError("");
        onClose();
      }}
      title={lesson?.title || ""}
      className="max-w-2xl"
    >
      {lesson && (
        <div className="space-y-5">
          {/* Subject & Curriculum context */}
          {(subjectName || curriculumName) && (
            <div className="flex items-center gap-2 text-xs text-muted">
              {subjectName && <span className="rounded-full bg-surface-muted px-2.5 py-0.5 font-medium">{subjectName}</span>}
              {curriculumName && (
                <>
                  <span className="text-border">·</span>
                  <span>{curriculumName}</span>
                </>
              )}
            </div>
          )}
          {/* Description */}
          {lesson.description && (
            <div className="whitespace-pre-wrap">
              <MarkdownContent
                content={lesson.description}
                className="text-tertiary"
              />
              {parseChecklist(lesson.description).length > 0 && (
                <div className="mt-4 border-t border-light pt-4">
                  <InteractiveChecklist
                    lessonId={lesson.id}
                    items={parseChecklist(lesson.description)}
                    state={lesson.checklist_state || {}}
                  />
                </div>
              )}
            </div>
          )}

          {/* Resources */}
          {lesson.resources.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Resources ({lesson.resources.length})
              </h4>
              <div className="space-y-2">
                {lesson.resources.map((r) => {
                  const rType = r.global_type || r.type;
                  const isVideo = rType === "youtube" || rType === "video";
                  return (
                    <ResourceCard
                      key={r.id}
                      type={rType}
                      url={r.url}
                      title={r.title}
                      thumbnailUrl={r.global_thumbnail_url || r.thumbnail_url}
                      onPreview={
                        isVideo
                          ? () =>
                              setPreviewResource({
                                title: r.title || "Untitled",
                                type: rType,
                                url: r.url,
                                thumbnailUrl:
                                  r.global_thumbnail_url || r.thumbnail_url,
                              })
                          : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}

          {/* Lesson Cards (building blocks) */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                Lesson Cards ({lesson.cards?.length || 0})
              </h4>
            </div>
            <DndContext sensors={cardSensors} collisionDetection={closestCenter} onDragEnd={handleCardDragEnd}>
              <SortableContext items={(lesson.cards || []).map((c) => c.id)} strategy={verticalListSortingStrategy}>
                {(lesson.cards || []).map((card) => {
                  const ytId = card.url ? extractYoutubeId(card.url) : null;
                  const thumb = card.thumbnail_url || (ytId ? `https://img.youtube.com/vi/${ytId}/mqdefault.jpg` : null)
                    || card.resource_thumbnail_url;
                  const cardTitle = card.title || card.resource_title || card.url || "Untitled";

                  return (
                    <SortableLessonCardWrapper key={card.id} id={card.id}>
                      <div className="mb-2 flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                          {card.card_type === "youtube" && thumb ? (
                            <div className="group relative">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); card.url && setPreviewResource({
                                  title: cardTitle, type: "youtube", url: card.url, thumbnailUrl: thumb,
                                }); }}
                                className="w-full overflow-hidden rounded-lg border border-light text-left transition-colors hover:border-interactive/50 cursor-pointer"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={thumb} alt="" className="w-full object-cover" />
                                <div className="flex items-center gap-1.5 px-3 py-1.5">
                                  <span className="text-xs text-red-500">▶</span>
                                  <span className="truncate text-sm text-secondary group-hover:text-interactive">{cardTitle}</span>
                                </div>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setOpenLessonCard({ card, allCards: lesson.cards || [] }); }}
                                className="absolute top-2 right-2 rounded-md bg-surface/80 p-1 text-muted opacity-0 transition-opacity hover:text-interactive group-hover:opacity-100 cursor-pointer"
                                title="Expand card"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 3 21 3 21 9" /><polyline points="9 21 3 21 3 15" /><line x1="21" y1="3" x2="14" y2="10" /><line x1="3" y1="21" x2="10" y2="14" /></svg>
                              </button>
                            </div>
                          ) : card.card_type === "image" && card.url ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenLessonCard({ card, allCards: lesson.cards || [] }); }}
                              className="group w-full overflow-hidden rounded-lg border border-light transition-colors hover:border-interactive/50 block text-left cursor-pointer"
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={card.url} alt={cardTitle} className="w-full object-cover" />
                              {card.title && (
                                <div className="px-3 py-1.5">
                                  <span className="truncate text-sm text-secondary group-hover:text-interactive">{card.title}</span>
                                </div>
                              )}
                            </button>
                          ) : card.card_type === "url" && card.url ? (
                            card.og_image ? (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setOpenLessonCard({ card, allCards: lesson.cards || [] }); }}
                                className="group block w-full overflow-hidden rounded-lg border border-light text-left transition-colors hover:border-interactive/50 cursor-pointer"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={card.og_image} alt="" className="w-full object-cover" />
                                <div className="flex items-center gap-1.5 px-3 py-1.5">
                                  <span className="text-xs">🔗</span>
                                  <span className="truncate text-sm text-secondary group-hover:text-interactive">{card.og_title || cardTitle}</span>
                                </div>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); setOpenLessonCard({ card, allCards: lesson.cards || [] }); }}
                                className="group flex w-full items-center gap-3 rounded-lg border border-light bg-surface p-3 text-sm text-left transition-colors hover:border-interactive/50 cursor-pointer"
                              >
                                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-cyan-50 to-blue-100 text-sm">🔗</span>
                                <span className="min-w-0 truncate text-secondary group-hover:text-interactive">{cardTitle}</span>
                              </button>
                            )
                          ) : card.card_type === "checklist" && card.content ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenLessonCard({ card, allCards: lesson.cards || [] }); }}
                              className="w-full rounded-lg border border-light bg-surface p-3 text-sm text-left transition-colors hover:border-interactive/50 cursor-pointer"
                            >
                              <p className="font-medium text-secondary">{cardTitle}</p>
                              <div className="mt-2 space-y-1">
                                {card.content.split("\n").filter((l) => /^- \[[ x]\]/.test(l)).map((line, i) => {
                                  const isChecked = /^- \[x\]/i.test(line);
                                  const text = line.replace(/^- \[[ x]\]\s*/, "");
                                  return (
                                    <span key={i} className="flex items-center gap-2 text-xs">
                                      <span className={`h-3.5 w-3.5 flex-shrink-0 rounded border ${isChecked ? "bg-interactive border-interactive text-white flex items-center justify-center" : "border-border"}`}>
                                        {isChecked && <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>}
                                      </span>
                                      <span className={isChecked ? "text-muted line-through" : "text-secondary"}>{text}</span>
                                    </span>
                                  );
                                })}
                              </div>
                            </button>
                          ) : card.card_type === "resource" ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenLessonCard({ card, allCards: lesson.cards || [] }); }}
                              className="group flex w-full items-center gap-3 rounded-lg border border-light bg-surface p-3 text-sm text-left transition-colors hover:border-interactive/50 cursor-pointer"
                            >
                              {card.resource_thumbnail_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={card.resource_thumbnail_url} alt="" className="h-10 w-16 flex-shrink-0 rounded object-cover" />
                              ) : (
                                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br from-indigo-50 to-purple-100 text-sm">📦</span>
                              )}
                              <span className="min-w-0 truncate text-secondary group-hover:text-interactive">{card.resource_title || cardTitle}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setOpenLessonCard({ card, allCards: lesson.cards || [] }); }}
                              className="w-full rounded-lg border border-light bg-surface p-3 text-sm text-left transition-colors hover:border-interactive/50 cursor-pointer"
                            >
                              <p className="text-secondary">{cardTitle}</p>
                              {card.content && <p className="mt-1 text-xs text-muted">{card.content}</p>}
                            </button>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => startTransition(async () => {
                            await deleteLessonCard(card.id);
                          })}
                          disabled={isPending}
                          className="mt-2 flex-shrink-0 rounded p-1 text-xs text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                          title="Remove card"
                        >
                          ✕
                        </button>
                      </div>
                    </SortableLessonCardWrapper>
                  );
                })}
              </SortableContext>
            </DndContext>

            {/* Add lesson card form */}
            <AddLessonCardForm lessonId={lesson.id} />
          </div>

          {/* Curriculum Resources — available to attach */}
          {unattachedCurriculumResources.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">
                Curriculum Resources
              </h4>
              <div className="space-y-2">
                {unattachedCurriculumResources.map((cr) => {
                  const cfg = typeConfig[cr.type] || typeConfig.url;
                  return (
                    <div
                      key={cr.id}
                      className="flex items-center gap-3 rounded-lg border border-dashed border-light bg-surface p-3 text-sm"
                    >
                      {cr.thumbnail_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={cr.thumbnail_url}
                          alt=""
                          className="h-10 w-16 flex-shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span
                          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${cfg.bg} text-base`}
                        >
                          {cfg.icon}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-secondary">{cr.title}</p>
                        {cr.description && (
                          <p className="truncate text-xs text-muted">{cr.description}</p>
                        )}
                      </div>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleAttachCurriculumResource(cr.id)}
                        className="flex-shrink-0 rounded bg-interactive px-2 py-1 text-xs font-medium text-white transition-colors hover:bg-interactive-hover disabled:opacity-50"
                      >
                        {isPending ? "..." : "Attach"}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Resource Suggestions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted">
                AI Suggestions
              </h4>
              <button
                type="button"
                onClick={handleSuggestResources}
                disabled={suggestingResources}
                className="rounded-md bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 hover:bg-purple-200 disabled:opacity-50 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
              >
                {suggestingResources ? "Thinking..." : "Suggest Resources"}
              </button>
            </div>
            {aiError && (
              <p className="mb-2 text-xs text-red-600">{aiError}</p>
            )}
            {aiSuggestions.length > 0 && (
              <div className="space-y-2">
                {aiSuggestions.map((suggestion, i) => {
                  const cfg = typeConfig[suggestion.type] || typeConfig.url;
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-dashed border-purple-200 bg-purple-50/50 p-3 text-sm dark:border-purple-800 dark:bg-purple-900/10"
                    >
                      <div className="flex items-start gap-2">
                        <span
                          className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded bg-gradient-to-br ${cfg.bg} text-sm`}
                        >
                          {cfg.icon}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-primary">{suggestion.title}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            <span className="mr-1 rounded bg-purple-100 px-1 py-0.5 text-[10px] font-medium uppercase text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
                              {suggestion.type}
                            </span>
                            {suggestion.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <ResourcePreviewModal
        open={!!previewResource}
        onClose={() => setPreviewResource(null)}
        title={previewResource?.title || ""}
        type={previewResource?.type || ""}
        url={previewResource?.url || null}
        thumbnailUrl={previewResource?.thumbnailUrl}
      />
      {openLessonCard && (
        <LessonCardModal
          open={!!openLessonCard}
          onClose={() => setOpenLessonCard(null)}
          card={openLessonCard.card}
          allCards={openLessonCard.allCards}
          onNavigate={(cardId) => {
            const next = openLessonCard.allCards.find((c) => c.id === cardId);
            if (next) setOpenLessonCard({ card: next, allCards: openLessonCard.allCards });
          }}
        />
      )}
    </Modal>
  );
}
