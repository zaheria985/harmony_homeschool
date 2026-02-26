"use client";

import { useState, useTransition } from "react";
import Modal from "@/components/ui/Modal";
import MarkdownContent from "@/components/ui/MarkdownContent";
import ResourcePreviewModal from "@/components/ui/ResourcePreviewModal";
import InteractiveChecklist, { parseChecklist } from "@/components/lessons/InteractiveChecklist";
import { attachResourceToLessons } from "@/lib/actions/resources";

type CurriculumResource = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
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
  } | null;
  curriculumResources?: CurriculumResource[];
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

export default function CardViewModal({ lesson, curriculumResources = [], onClose }: CardViewModalProps) {
  const [previewResource, setPreviewResource] = useState<{
    title: string;
    type: string;
    url: string;
    thumbnailUrl: string | null;
  } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [recentlyAttached, setRecentlyAttached] = useState<Set<string>>(new Set());

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

  return (
    <Modal
      open={!!lesson}
      onClose={() => {
        setRecentlyAttached(new Set());
        onClose();
      }}
      title={lesson?.title || ""}
      className="max-w-2xl"
    >
      {lesson && (
        <div className="space-y-5">
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
    </Modal>
  );
}
