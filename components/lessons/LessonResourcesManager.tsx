"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ResourcePreviewModal from "@/components/ui/ResourcePreviewModal";
import {
  deleteLessonResource,
  attachResourceToLessons,
  addResource,
  bulkAddSuppliesToLesson,
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
  attachment_notes: string | null;
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
  readOnly?: boolean;
};
const INLINE_TYPES = ["youtube", "pdf", "filerun", "url"] as const;
const typeConfig: Record<
  string,
  {
    icon: string;
    label: string;
    variant: "default" | "primary" | "warning" | "danger" | "info";
  }
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
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
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
  onOpen,
}: {
  type: string;
  url: string;
  title: string | null;
  thumbnailUrl: string | null;
  description: string | null;
  resourceId: string | null;
  onOpen: () => void;
}) {
  const config = typeConfig[type] || typeConfig.url;
  const displayTitle = title || url || "Untitled";
  const youtubeId =
    (type === "youtube" || type === "video") && url
      ? extractYoutubeId(url)
      : null;
  return (
    <>
      {" "}
      {/* Thumbnail / embed area */}{" "}
      {youtubeId ? (
        <div className="relative aspect-video w-full overflow-hidden bg-gray-900">
          {" "}
          {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
          <img
            src={`https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`}
            alt={displayTitle}
            className="h-full w-full object-contain"
          />{" "}
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            {" "}
            <span className="text-3xl">▶</span>{" "}
          </div>{" "}
        </div>
      ) : thumbnailUrl ? (
        <div className="relative aspect-video w-full overflow-hidden border-b border-light p-1.5">
          {" "}
          {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
          <img
            src={thumbnailUrl}
            alt={displayTitle}
            className="h-full w-full rounded object-contain"
          />{" "}
        </div>
      ) : type === "pdf" ? (
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
          {" "}
          <div className="text-center">
            {" "}
            <span className="text-4xl">📄</span>{" "}
            <p className="mt-0.5 text-xs text-muted">
              .pdf
            </p>{" "}
          </div>{" "}
        </div>
      ) : type === "book" ? (
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-violet-900/20">
          {" "}
          <span className="text-4xl">📕</span>{" "}
        </div>
      ) : type === "supply" ? (
        <div className="flex h-24 items-center justify-center bg-gradient-to-br from-gray-50 to-slate-100 dark:from-slate-800/40 dark:to-slate-900/40">
          {" "}
          <span className="text-4xl">🧰</span>{" "}
        </div>
      ) : (
        <div className="flex h-16 items-center justify-center bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20">
          {" "}
          <div className="text-center">
            {" "}
            <span className="text-xl">{config.icon}</span>{" "}
            {url && (
              <p className="mt-0.5 text-[10px] text-muted">
                {" "}
                {getDomain(url)}{" "}
              </p>
            )}{" "}
          </div>{" "}
        </div>
      )}{" "}
      {/* Content */}{" "}
      <div className="p-3">
        {" "}
        <div className="mb-1.5 flex items-center gap-1.5">
          {" "}
          <Badge variant={config.variant}>{config.label}</Badge>{" "}
          {resourceId && (
            <Link
              href={`/resources/${resourceId}`}
              className="text-xs text-primary-500 hover:underline"
            >
              {" "}
              Library{" "}
            </Link>
          )}{" "}
        </div>{" "}
        {url ? (
          <button
            type="button"
            onClick={onOpen}
            className="block text-left text-sm font-medium text-primary hover:text-interactive line-clamp-2"
          >
            {" "}
            {displayTitle}{" "}
          </button>
        ) : (
          <p className="text-sm font-medium text-primary line-clamp-2">
            {" "}
            {displayTitle}{" "}
          </p>
        )}{" "}
        {description && (
          <p className="mt-1 text-xs text-muted line-clamp-2">
            {" "}
            {description}{" "}
          </p>
        )}{" "}
      </div>{" "}
    </>
  );
}
export default function LessonResourcesManager({
  lessonId,
  resources,
  curriculumResources,
  libraryResources,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showLibrary, setShowLibrary] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [showBulkSupplies, setShowBulkSupplies] = useState(false);
  const [bulkSupplyText, setBulkSupplyText] = useState("");
  const [librarySearch, setLibrarySearch] = useState("");
  const [selectedLibrary, setSelectedLibrary] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [previewResource, setPreviewResource] = useState<{
    title: string;
    type: string;
    url: string;
    thumbnailUrl: string | null;
  } | null>(null);
  const attachedResourceIds = new Set(
    resources.filter((r) => r.resource_id).map((r) => r.resource_id),
  );
  const availableLibrary = libraryResources.filter(
    (r) => !attachedResourceIds.has(r.id),
  );
  const filteredLibrary = availableLibrary.filter(
    (r) =>
      !librarySearch ||
      r.title.toLowerCase().includes(librarySearch.toLowerCase()) ||
      (r.description || "").toLowerCase().includes(librarySearch.toLowerCase()),
  );
  function openPreview(resource: {
    title: string | null;
    type: string;
    url: string | null;
    thumbnailUrl: string | null;
  }) {
    if (!resource.url) return;
    setPreviewResource({
      title: resource.title || resource.url,
      type: resource.type,
      url: resource.url,
      thumbnailUrl: resource.thumbnailUrl,
    });
  }
  function handleRemove(lessonResourceId: string) {
    if (!confirm("Remove this resource from the lesson?")) return;
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
      {" "}
      {/* Lesson Resources Section */}{" "}
      <div className="rounded-2xl border border-light bg-surface p-6 shadow-warm">
        {" "}
        <div className="mb-4 flex items-center justify-between">
          {" "}
          <h3 className="text-lg font-semibold text-primary">
            {" "}
            Resources ({resources.length}){" "}
          </h3>{" "}
          {!readOnly && (
            <div className="flex gap-2">
              {" "}
              <button
                onClick={() => setShowLibrary(true)}
                className="rounded-lg bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:bg-interactive-hover"
              >
                {" "}
                + From Library{" "}
              </button>{" "}
              <button
                onClick={() => setShowQuickAdd(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-tertiary hover:bg-surface-muted"
              >
                {" "}
                + Quick Add{" "}
              </button>{" "}
              <button
                onClick={() => setShowBulkSupplies(true)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-tertiary hover:bg-surface-muted"
              >
                {" "}
                + Bulk Supplies{" "}
              </button>{" "}
            </div>
          )}{" "}
        </div>{" "}
        {error && (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}{" "}
        {resources.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            {" "}
            No resources attached yet{" "}
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {" "}
            {resources.map((r) => (
              <div
                key={r.id}
                className="group relative overflow-hidden rounded-2xl border border-light bg-surface shadow-warm transition-shadow hover:shadow-warm-md"
              >
                {" "}
                <ResourceCardInner
                  type={r.global_type || r.type}
                  url={r.url}
                  title={r.title}
                  thumbnailUrl={r.global_thumbnail_url || r.thumbnail_url}
                  description={r.resource_description}
                  resourceId={r.resource_id}
                  onOpen={() =>
                    openPreview({
                      title: r.title,
                      type: r.global_type || r.type,
                      url: r.url,
                      thumbnailUrl: r.global_thumbnail_url || r.thumbnail_url,
                    })
                  }
                />{" "}
                {!readOnly && (
                  <button
                    onClick={() => handleRemove(r.id)}
                    disabled={isPending}
                    aria-label={`Remove resource ${r.title || r.url}`}
                    className="absolute right-2 top-2 z-10 rounded-full bg-surface/90 p-1.5 text-muted opacity-0 shadow-warm transition-opacity hover:bg-[var(--error-bg)] hover:text-red-500 group-hover:opacity-100 disabled:opacity-50/90 dark:hover:bg-red-900/30"
                    title="Remove resource"
                  >
                    {" "}
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      {" "}
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />{" "}
                    </svg>{" "}
                  </button>
                )}{" "}
              </div>
            ))}{" "}
          </div>
        )}{" "}
      </div>{" "}
      {/* Shared Course Resources Section */}{" "}
      {curriculumResources.length > 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface-muted/50 p-6/40">
          {" "}
          <h3 className="mb-1 text-sm font-semibold text-secondary">
            {" "}
            Shared Course Resources{" "}
          </h3>{" "}
          <p className="mb-4 text-xs text-muted">
            {" "}
            Resources shared across all lessons in this curriculum{" "}
          </p>{" "}
          <div className="grid gap-3 sm:grid-cols-2">
            {" "}
            {curriculumResources.map((r) => {
              const config = typeConfig[r.type] || typeConfig.url;
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 rounded-lg border border-light bg-surface p-3"
                >
                  {" "}
                  {r.thumbnail_url ? (
                    <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded border border-light p-1">
                      {" "}
                      {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                      <img
                        src={r.thumbnail_url}
                        alt={r.title}
                        className="h-full w-full rounded object-contain"
                      />{" "}
                    </div>
                  ) : (
                    <span className="text-xl flex-shrink-0">{config.icon}</span>
                  )}{" "}
                  <div className="min-w-0 flex-1">
                    {" "}
                    {r.url ? (
                      <button
                        type="button"
                        onClick={() =>
                          openPreview({
                            title: r.title,
                            type: r.type,
                            url: r.url,
                            thumbnailUrl: r.thumbnail_url,
                          })
                        }
                        className="text-left text-sm font-medium text-primary truncate hover:text-interactive"
                      >
                        {" "}
                        {r.title}{" "}
                      </button>
                    ) : (
                      <p className="text-sm font-medium text-primary truncate">
                        {" "}
                        {r.title}{" "}
                      </p>
                    )}{" "}
                    {r.attachment_notes && (
                      <p className="text-xs text-muted truncate">
                        {" "}
                        {r.attachment_notes}{" "}
                      </p>
                    )}{" "}
                  </div>{" "}
                  <Badge variant={config.variant}>{config.label}</Badge>{" "}
                </div>
              );
            })}{" "}
          </div>{" "}
        </div>
      )}{" "}
      {/* Library Modal */}{" "}
      {!readOnly && (
        <Modal
          open={showLibrary}
          onClose={() => {
            setShowLibrary(false);
            setSelectedLibrary([]);
            setLibrarySearch("");
          }}
          title="Add from Resource Library"
        >
          {" "}
          <div className="space-y-4">
            {" "}
            <input
              type="text"
              placeholder="Search resources..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-[var(--input-placeholder)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
            />{" "}
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {" "}
              {filteredLibrary.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted">
                  {" "}
                  {availableLibrary.length === 0
                    ? "All library resources already attached"
                    : "No matching resources"}{" "}
                </p>
              ) : (
                filteredLibrary.map((r) => {
                  const cfg = typeConfig[r.type] || typeConfig.url;
                  return (
                    <label
                      key={r.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-muted"
                    >
                      {" "}
                      <input
                        type="checkbox"
                        checked={selectedLibrary.includes(r.id)}
                        onChange={() =>
                          setSelectedLibrary((prev) =>
                            prev.includes(r.id)
                              ? prev.filter((x) => x !== r.id)
                              : [...prev, r.id],
                          )
                        }
                        className="rounded border-border text-interactive focus:ring-focus"
                      />{" "}
                      <span className="text-lg flex-shrink-0">{cfg.icon}</span>{" "}
                      <div className="min-w-0 flex-1">
                        {" "}
                        <p className="text-sm font-medium text-primary truncate">
                          {" "}
                          {r.title}{" "}
                        </p>{" "}
                        {r.description && (
                          <p className="text-xs text-muted truncate">
                            {" "}
                            {r.description}{" "}
                          </p>
                        )}{" "}
                      </div>{" "}
                      <Badge variant={cfg.variant}>{cfg.label}</Badge>{" "}
                    </label>
                  );
                })
              )}{" "}
            </div>{" "}
            {selectedLibrary.length > 0 && (
              <p className="text-xs text-muted">
                {" "}
                {selectedLibrary.length} selected{" "}
              </p>
            )}{" "}
            <div className="flex justify-end gap-2">
              {" "}
              <button
                onClick={() => {
                  setShowLibrary(false);
                  setSelectedLibrary([]);
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
              >
                {" "}
                Cancel{" "}
              </button>{" "}
              <button
                onClick={handleAttachFromLibrary}
                disabled={isPending || selectedLibrary.length === 0}
                className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
              >
                {" "}
                {isPending
                  ? "Adding..."
                  : `Add (${selectedLibrary.length})`}{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
        </Modal>
      )}{" "}
      {/* Quick Add Modal */}{" "}
      {!readOnly && (
        <Modal
          open={showQuickAdd}
          onClose={() => setShowQuickAdd(false)}
          title="Quick Add Resource"
        >
          {" "}
          <form
            onSubmit={(event) => {
              event.preventDefault();
              handleQuickAdd(new FormData(event.currentTarget));
            }}
            className="space-y-4"
          >
            {" "}
            <input type="hidden" name="lesson_id" value={lessonId} />{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                {" "}
                Type{" "}
              </label>{" "}
              <select
                name="type"
                required
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
              >
                {" "}
                {INLINE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {" "}
                    {t === "youtube"
                      ? "YouTube"
                      : t === "pdf"
                        ? "PDF"
                        : t === "filerun"
                          ? "FileRun"
                          : "URL / Link"}{" "}
                  </option>
                ))}{" "}
              </select>{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                {" "}
                URL{" "}
              </label>{" "}
              <input
                name="url"
                type="url"
                required
                placeholder="https://..."
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-[var(--input-placeholder)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
              />{" "}
            </div>{" "}
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                {" "}
                Title (optional){" "}
              </label>{" "}
              <input
                name="title"
                placeholder="Resource title"
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-[var(--input-placeholder)] focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
              />{" "}
            </div>{" "}
            <div className="flex justify-end gap-2">
              {" "}
              <button
                type="button"
                onClick={() => setShowQuickAdd(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
              >
                {" "}
                Cancel{" "}
              </button>{" "}
              <button
                type="submit"
                disabled={isPending}
                className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
              >
                {" "}
                {isPending ? "Adding..." : "Add Resource"}{" "}
              </button>{" "}
            </div>{" "}
          </form>{" "}
        </Modal>
      )}{" "}
      {!readOnly && (
        <Modal
          open={showBulkSupplies}
          onClose={() => setShowBulkSupplies(false)}
          title="Bulk Add Supplies"
        >
          {" "}
          <div className="space-y-3">
            {" "}
            <p className="text-xs text-muted">
              {" "}
              Paste one supply per line. Example: notebook, glue sticks, colored
              pencils.{" "}
            </p>{" "}
            <textarea
              value={bulkSupplyText}
              onChange={(e) => setBulkSupplyText(e.target.value)}
              rows={8}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-[var(--input-placeholder)]"
              placeholder="Notebook\nGlue sticks\nColored pencils"
            />{" "}
            <div className="flex justify-end gap-2">
              {" "}
              <button
                onClick={() => setShowBulkSupplies(false)}
                className="rounded-lg border border-border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
              >
                {" "}
                Cancel{" "}
              </button>{" "}
              <button
                onClick={() =>
                  startTransition(async () => {
                    const result = await bulkAddSuppliesToLesson(
                      lessonId,
                      bulkSupplyText,
                    );
                    if ("error" in result) {
                      setError(result.error || "Failed to add supplies");
                      return;
                    }
                    setBulkSupplyText("");
                    setShowBulkSupplies(false);
                    router.refresh();
                  })
                }
                disabled={isPending || !bulkSupplyText.trim()}
                className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
              >
                {" "}
                {isPending ? "Adding..." : "Add Supplies"}{" "}
              </button>{" "}
            </div>{" "}
          </div>{" "}
        </Modal>
      )}{" "}
      <ResourcePreviewModal
        open={!!previewResource}
        onClose={() => setPreviewResource(null)}
        title={previewResource?.title || "Resource"}
        type={previewResource?.type || "link"}
        url={previewResource?.url || null}
        thumbnailUrl={previewResource?.thumbnailUrl}
      />{" "}
    </div>
  );
}
