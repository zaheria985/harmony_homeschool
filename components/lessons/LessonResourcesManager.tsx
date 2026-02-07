"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import {
  deleteLessonResource,
  attachResourceToLessons,
  addResource,
} from "@/lib/actions/resources";

type LessonResource = {
  id: string;
  type: string;
  url: string;
  title: string | null;
  thumbnail_url: string | null;
  resource_id: string | null;
  resource_description: string | null;
  global_type: string | null;
  global_thumbnail_url: string | null;
};

type CurriculumResource = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
  from_lesson_title: string;
  from_lesson_id: string;
};

type LibraryResource = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  description: string | null;
};

type Props = {
  lessonId: string;
  resources: LessonResource[];
  curriculumResources: CurriculumResource[];
  libraryResources: LibraryResource[];
};

const INLINE_TYPES = ["youtube", "pdf", "filerun", "url"] as const;

const typeConfig: Record<
  string,
  { icon: string; label: string; variant: "default" | "primary" | "warning" | "danger" | "info" }
> = {
  youtube: { icon: "▶", label: "YouTube", variant: "danger" },
  video: { icon: "🎬", label: "Video", variant: "danger" },
  pdf: { icon: "📄", label: "PDF", variant: "warning" },
  filerun: { icon: "📁", label: "File", variant: "info" },
  url: { icon: "🔗", label: "Link", variant: "info" },
  link: { icon: "🔗", label: "Link", variant: "info" },
  book: { icon: "📕", label: "Book", variant: "primary" },
  supply: { icon: "🧰", label: "Supply", variant: "default" },
};

function extractYoutubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return "";
  }
}

function ResourceCardInner({
  type,
  url,
  title,
  thumbnailUrl,
  description,
  resourceId,
}: {
  type: string;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  resourceId: string | null;
}) {
  const config = typeConfig[type] || typeConfig.url;
  const displayTitle = title || url || "Untitled";
  const youtubeId =
    (type === "youtube" || type === "video") && url
      ? extractYoutubeId(url)
      : null;

  return (
    <>
      {/* Thumbnail / embed area */}
      {youtubeId ? (
        <div className="relative aspect-video w-full bg-gray-900">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
            title={displayTitle}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
      ) : thumbnailUrl ? (
        <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbnailUrl}
            alt={displayTitle}
            className="h-full w-full object-cover"
          />
        </div>
      ) : type === "pdf" ? (
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50">
          <div className="text-center">
            <span className="text-4xl">📄</span>
            <p className="mt-0.5 text-xs text-gray-400">.pdf</p>
          </div>
        </div>
      ) : type === "book" ? (
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50">
          <span className="text-4xl">📕</span>
        </div>
      ) : type === "supply" ? (
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-gray-50 to-slate-100">
          <span className="text-4xl">🧰</span>
        </div>
      ) : (
        <div className="flex h-16 items-center justify-center bg-gradient-to-r from-blue-50 to-cyan-50">
          <div className="text-center">
            <span className="text-xl">{config.icon}</span>
            {url && (
              <p className="mt-0.5 text-[10px] text-gray-400">
                {getDomain(url)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-3">
        <div className="mb-1.5 flex items-center gap-1.5">
          <Badge variant={config.variant}>{config.label}</Badge>
          {resourceId && (
            <Link
              href={`/resources/${resourceId}`}
              className="text-xs text-primary-500 hover:underline"
            >
              Library
            </Link>
          )}
        </div>

        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block text-sm font-medium text-gray-900 hover:text-primary-600 line-clamp-2"
          >
            {displayTitle}
          </a>
        ) : (
          <p className="text-sm font-medium text-gray-900 line-clamp-2">
            {displayTitle}
          </p>
        )}

        {description && (
          <p className="mt-1 text-xs text-gray-400 line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </>
  );
}

export default function LessonResourcesManager({
  lessonId,
  resources,
  curriculumResources,
  libraryResources,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showLibrary, setShowLibrary] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedLibrary, setSelectedLibrary] = useState<string[]>([]);
  const [error, setError] = useState("");

  const attachedResourceIds = new Set(
    resources.filter((r) => r.resource_id).map((r) => r.resource_id)
  );
  const availableLibrary = libraryResources.filter(
    (r) => !attachedResourceIds.has(r.id)
  );
  const filteredLibrary = availableLibrary.filter(
    (r) =>
      !librarySearch ||
      r.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(librarySearch.toLowerCase())
  );

  function handleRemove(lessonResourceId: string) {
    startTransition(async () => {
      await deleteLessonResource(lessonResourceId);
      router.refresh();
    });
  }

  function handleAttachFromLibrary() {
    if (selectedLibrary.length === 0) return;
    setError("");
    startTransition(async () => {
      for (const resourceId of selectedLibrary) {
        const result = await attachResourceToLessons(resourceId, [lessonId]);
        if (result.error) {
          setError(result.error);
          return;
        }
      }
      setShowLibrary(false);
      setSelectedLibrary([]);
      setLibrarySearch("");
      router.refresh();
    });
  }

  function handleQuickAdd(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await addResource(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setShowQuickAdd(false);
        router.refresh();
      }
    });
  }

  function handleAttachCurriculumResource(resourceId: string) {
    startTransition(async () => {
      const result = await attachResourceToLessons(resourceId, [lessonId]);
      if (result.error) setError(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Lesson Resources Section */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            Resources ({resources.length})
          </h3>
          <div className="flex gap-2">
            <button
              onClick={() => setShowLibrary(true)}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700"
            >
              + From Library
            </button>
            <button
              onClick={() => setShowQuickAdd(true)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              + Quick Add
            </button>
          </div>
        </div>

        {error && (
          <p className="mb-3 text-sm text-red-600">{error}</p>
        )}

        {resources.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-400">
            No resources attached yet
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {resources.map((r) => (
              <div
                key={r.id}
                className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <ResourceCardInner
                  type={r.global_type || r.type}
                  url={r.url}
                  title={r.title}
                  thumbnailUrl={r.global_thumbnail_url || r.thumbnail_url}
                  description={r.resource_description}
                  resourceId={r.resource_id}
                />
                {/* Remove overlay */}
                <button
                  onClick={() => handleRemove(r.id)}
                  disabled={isPending}
                  className="absolute right-2 top-2 z-10 rounded-full bg-white/90 p-1.5 text-gray-400 opacity-0 shadow-sm transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:opacity-50"
                  title="Remove resource"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Curriculum Resources Section */}
      {curriculumResources.length > 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 p-6">
          <h3 className="mb-1 text-sm font-semibold text-gray-700">
            Also in this Curriculum
          </h3>
          <p className="mb-4 text-xs text-gray-400">
            Resources used by other lessons in the same curriculum
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {curriculumResources.map((r) => {
              const config = typeConfig[r.type] || typeConfig.url;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3"
                >
                  <span className="text-xl flex-shrink-0">{config.icon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {r.title}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      From:{" "}
                      <Link
                        href={`/lessons/${r.from_lesson_id}`}
                        className="text-primary-500 hover:underline"
                      >
                        {r.from_lesson_title}
                      </Link>
                    </p>
                  </div>
                  <button
                    onClick={() => handleAttachCurriculumResource(r.id)}
                    disabled={isPending}
                    className="flex-shrink-0 rounded-lg border border-primary-300 px-2 py-1 text-xs font-medium text-primary-600 hover:bg-primary-50 disabled:opacity-50"
                  >
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Library Modal */}
      <Modal
        open={showLibrary}
        onClose={() => {
          setShowLibrary(false);
          setSelectedLibrary([]);
          setLibrarySearch("");
        }}
        title="Add from Resource Library"
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search resources..."
            value={librarySearch}
            onChange={(e) => setLibrarySearch(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filteredLibrary.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                {availableLibrary.length === 0
                  ? "All library resources already attached"
                  : "No matching resources"}
              </p>
            ) : (
              filteredLibrary.map((r) => {
                const cfg = typeConfig[r.type] || typeConfig.url;
                return (
                  <label
                    key={r.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedLibrary.includes(r.id)}
                      onChange={() =>
                        setSelectedLibrary((prev) =>
                          prev.includes(r.id)
                            ? prev.filter((x) => x !== r.id)
                            : [...prev, r.id]
                        )
                      }
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-lg flex-shrink-0">{cfg.icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {r.title}
                      </p>
                      {r.description && (
                        <p className="text-xs text-gray-400 truncate">
                          {r.description}
                        </p>
                      )}
                    </div>
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                  </label>
                );
              })
            )}
          </div>
          {selectedLibrary.length > 0 && (
            <p className="text-xs text-gray-500">
              {selectedLibrary.length} selected
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowLibrary(false);
                setSelectedLibrary([]);
              }}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAttachFromLibrary}
              disabled={isPending || selectedLibrary.length === 0}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? "Adding..." : `Add (${selectedLibrary.length})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Quick Add Modal */}
      <Modal
        open={showQuickAdd}
        onClose={() => setShowQuickAdd(false)}
        title="Quick Add Resource"
      >
        <form action={handleQuickAdd} className="space-y-4">
          <input type="hidden" name="lesson_id" value={lessonId} />
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Type
            </label>
            <select
              name="type"
              required
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {INLINE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t === "youtube"
                    ? "YouTube"
                    : t === "pdf"
                      ? "PDF"
                      : t === "filerun"
                        ? "FileRun"
                        : "URL / Link"}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              URL
            </label>
            <input
              name="url"
              type="url"
              required
              placeholder="https://..."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title (optional)
            </label>
            <input
              name="title"
              placeholder="Resource title"
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowQuickAdd(false)}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? "Adding..." : "Add Resource"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
