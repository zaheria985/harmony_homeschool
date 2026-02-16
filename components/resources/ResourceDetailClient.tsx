"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ResourcePreviewModal from "@/components/ui/ResourcePreviewModal";
import TagInput from "@/components/ui/TagInput";
import {
  updateGlobalResource,
  deleteGlobalResource,
  attachResourceToLessons,
  detachResourceFromLesson,
} from "@/lib/actions/resources";
type Lesson = {
  id: string;
  title: string;
  status: string;
  planned_date: string | null;
  subject_name: string;
  subject_color: string | null;
  child_name: string | null;
  child_id: string | null;
};
type Resource = {
  id: string;
  title: string;
  type: string;
  author: string | null;
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
  created_at: string;
  tags: string[];
  lessons: Lesson[];
};
type AvailableLesson = {
  id: string;
  title: string;
  child_name: string;
  subject_name: string;
};
type Booklist = { id: string; name: string };
const RESOURCE_TYPES = ["book", "video", "pdf", "link", "supply"] as const;
const typeIcons: Record<string, string> = {
  book: "📕",
  video: "🎬",
  pdf: "📄",
  link: "🔗",
  supply: "🧰",
};
const tagStyles = [
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200",
  "bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-200",
  "bg-amber-100 text-amber-700/40",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200",
];
function styleForTag(tag: string) {
  const sum = tag.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return tagStyles[sum % tagStyles.length];
}
const darkFieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-muted";
const darkFileClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary file:mr-3 file:rounded-md file:border-0 file:bg-surface-subtle file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-secondary hover:file:bg-surface-subtle";
export default function ResourceDetailClient({
  resource,
  allLessons,
  allTags,
  booklists,
  initialBooklistIds,
}: {
  resource: Resource;
  allLessons: AvailableLesson[];
  allTags: string[];
  booklists: Booklist[];
  initialBooklistIds: string[];
}) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [lessonSearch, setLessonSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [clearThumbnail, setClearThumbnail] = useState(false);
  const [editType, setEditType] = useState(resource.type);
  const [editTags, setEditTags] = useState(resource.tags.join(","));
  const [selectedBooklistIds, setSelectedBooklistIds] =
    useState<string[]>(initialBooklistIds);
  const [showPreview, setShowPreview] = useState(false);
  const linkedLessonIds = new Set(resource.lessons.map((l) => l.id));
  const availableLessons = allLessons.filter((l) => !linkedLessonIds.has(l.id));
  const filteredAvailable = availableLessons.filter(
    (l) =>
      !lessonSearch ||
      l.title.toLowerCase().includes(lessonSearch.toLowerCase()) ||
      l.child_name.toLowerCase().includes(lessonSearch.toLowerCase()) ||
      l.subject_name.toLowerCase().includes(lessonSearch.toLowerCase()),
  );
  function handleEdit(formData: FormData) {
    setError("");
    formData.delete("booklist_ids");
    if (editType === "book") {
      for (const booklistId of selectedBooklistIds) {
        formData.append("booklist_ids", booklistId);
      }
    }
    startTransition(async () => {
      const result = await updateGlobalResource(formData);
      if ("error" in result) {
        setError(result.error || "Failed to update resource");
      } else {
        setShowEdit(false);
      }
    });
  }
  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGlobalResource(resource.id);
      if ("error" in result) {
        setError(result.error || "Failed to delete resource");
      } else {
        router.push("/resources");
      }
    });
  }
  function handleAttach() {
    if (selectedLessons.length === 0) return;
    startTransition(async () => {
      const result = await attachResourceToLessons(
        resource.id,
        selectedLessons,
      );
      if ("error" in result) {
        setError(result.error || "Failed to attach resource");
      } else {
        setShowAttach(false);
        setSelectedLessons([]);
        setLessonSearch("");
      }
    });
  }
  function handleDetach(lessonId: string) {
    if (!confirm("Detach this resource from the lesson?")) return;
    startTransition(async () => {
      await detachResourceFromLesson(resource.id, lessonId);
    });
  }
  function toggleLesson(id: string) {
    setSelectedLessons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }
  function toggleBooklist(id: string) {
    setSelectedBooklistIds((prev) =>
      prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id],
    );
  }
  const statusVariant = (status: string) =>
    status === "completed"
      ? "success"
      : status === "in_progress"
        ? "warning"
        : ("default" as const);
  return (
    <>
      {" "}
      {/* Action buttons */}{" "}
      <div className="mb-6 flex gap-2">
        {" "}
        <button
          onClick={() => {
            setClearThumbnail(false);
            setEditType(resource.type);
            setEditTags(resource.tags.join(","));
            setSelectedBooklistIds(initialBooklistIds);
            setShowEdit(true);
          }}
          className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
        >
          {" "}
          Edit{" "}
        </button>{" "}
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-[var(--error-bg)]"
        >
          {" "}
          Delete{" "}
        </button>{" "}
        <Link
          href="/resources"
          className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
        >
          {" "}
          Back to Resources{" "}
        </Link>{" "}
      </div>{" "}
      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}{" "}
      <div className="grid gap-6 lg:grid-cols-2">
        {" "}
        {/* Details */}{" "}
        <div className="rounded-2xl border border-light bg-surface p-6 shadow-warm">
          {" "}
          <h3 className="mb-4 text-lg font-semibold text-primary">
            Details
          </h3>{" "}
          {resource.thumbnail_url && (
            <div className="mb-4">
              {" "}
              <div className="aspect-[3/4] max-w-[11rem] overflow-hidden rounded-lg border border-light p-2">
                {" "}
                {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                <img
                  src={resource.thumbnail_url}
                  alt={resource.title}
                  className="h-full w-full rounded object-contain"
                />{" "}
              </div>{" "}
            </div>
          )}{" "}
          <dl className="space-y-3">
            {" "}
            <div>
              {" "}
              <dt className="text-sm text-muted">Type</dt>{" "}
              <dd>
                {" "}
                <Badge>
                  {" "}
                  {typeIcons[resource.type]} {resource.type}{" "}
                </Badge>{" "}
              </dd>{" "}
            </div>{" "}
            {resource.url && (
              <div>
                {" "}
                <dt className="text-sm text-muted">URL</dt>{" "}
                <dd className="space-y-1">
                  {" "}
                  <button
                    type="button"
                    onClick={() => setShowPreview(true)}
                    className="text-sm text-interactive hover:underline"
                  >
                    {" "}
                    Preview inline{" "}
                  </button>{" "}
                  <div>
                    {" "}
                    <a
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted hover:underline break-all"
                    >
                      {" "}
                      {resource.url}{" "}
                    </a>{" "}
                  </div>{" "}
                </dd>{" "}
              </div>
            )}{" "}
            {resource.type === "book" && resource.author && (
              <div>
                {" "}
                <dt className="text-sm text-muted">Author</dt>{" "}
                <dd className="text-sm text-secondary">
                  {resource.author}
                </dd>{" "}
              </div>
            )}{" "}
            {resource.description && (
              <div>
                {" "}
                <dt className="text-sm text-muted">Notes</dt>{" "}
                <dd className="text-sm text-secondary">
                  {resource.description}
                </dd>{" "}
              </div>
            )}{" "}
            {resource.tags.length > 0 && (
              <div>
                {" "}
                <dt className="text-sm text-muted">Tags</dt>{" "}
                <dd className="mt-1 flex flex-wrap gap-1">
                  {" "}
                  {resource.tags.map((tag) => (
                    <span
                      key={`${resource.id}-${tag}`}
                      className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styleForTag(tag)}`}
                    >
                      {" "}
                      {tag}{" "}
                    </span>
                  ))}{" "}
                </dd>{" "}
              </div>
            )}{" "}
            <div>
              {" "}
              <dt className="text-sm text-muted">Added</dt>{" "}
              <dd className="text-sm text-secondary">
                {" "}
                {new Date(resource.created_at).toLocaleDateString()}{" "}
              </dd>{" "}
            </div>{" "}
          </dl>{" "}
        </div>{" "}
        {/* Linked Lessons */}{" "}
        <div className="rounded-2xl border border-light bg-surface p-6 shadow-warm">
          {" "}
          <div className="mb-4 flex items-center justify-between">
            {" "}
            <h3 className="text-lg font-semibold text-primary">
              {" "}
              Used in {resource.lessons.length}
              {""} {resource.lessons.length === 1 ? "lesson" : "lessons"}{" "}
            </h3>{" "}
            <button
              onClick={() => setShowAttach(true)}
              className="rounded-lg bg-interactive px-3 py-1.5 text-sm font-medium text-white hover:bg-interactive-hover"
            >
              {" "}
              + Attach to Lessons{" "}
            </button>{" "}
          </div>{" "}
          {resource.lessons.length === 0 ? (
            <p className="text-sm text-muted">
              {" "}
              Not linked to any lessons yet{" "}
            </p>
          ) : (
            <ul className="space-y-2">
              {" "}
              {resource.lessons.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-lg border border-light bg-surface p-3"
                >
                  {" "}
                  <div className="min-w-0 flex-1">
                    {" "}
                    <Link
                      href={`/lessons/${l.id}`}
                      className="text-sm font-medium text-interactive hover:underline"
                    >
                      {" "}
                      {l.title}{" "}
                    </Link>{" "}
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
                      {" "}
                      {l.subject_color && (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: l.subject_color }}
                        />
                      )}{" "}
                      <span>{l.subject_name}</span>{" "}
                      {l.child_name && (
                        <>
                          {" "}
                          <span>·</span> <span>{l.child_name}</span>{" "}
                        </>
                      )}{" "}
                      <Badge variant={statusVariant(l.status)}>
                        {" "}
                        {l.status}{" "}
                      </Badge>{" "}
                    </div>{" "}
                  </div>{" "}
                  <button
                    onClick={() => handleDetach(l.id)}
                    disabled={isPending}
                    aria-label={`Detach resource from lesson ${l.title}`}
                    className="ml-2 text-xs text-muted hover:text-red-500"
                    title="Detach from lesson"
                  >
                    {" "}
                    ✕{" "}
                  </button>{" "}
                </li>
              ))}{" "}
            </ul>
          )}{" "}
        </div>{" "}
      </div>{" "}
      {/* Edit Modal */}{" "}
      <Modal
        open={showEdit}
        onClose={() => {
          setShowEdit(false);
          setClearThumbnail(false);
        }}
        title="Edit Resource"
      >
        {" "}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleEdit(new FormData(event.currentTarget));
          }}
          className="space-y-4"
        >
          {" "}
          <input type="hidden" name="id" value={resource.id} />{" "}
          <input
            type="hidden"
            name="thumbnail_url"
            value={resource.thumbnail_url || ""}
          />{" "}
          <input
            type="hidden"
            name="clear_thumbnail"
            value={clearThumbnail ? "true" : "false"}
          />{" "}
          <input type="hidden" name="tags" value={editTags} />{" "}
          {error && <p className="text-sm text-red-600">{error}</p>}{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Title{" "}
            </label>{" "}
            <input
              name="title"
              required
              defaultValue={resource.title}
              className={darkFieldClass}
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Type{" "}
            </label>{" "}
            <select
              name="type"
              required
              value={editType}
              onChange={(e) => setEditType(e.target.value)}
              className={darkFieldClass}
            >
              {" "}
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {" "}
                  {t.charAt(0).toUpperCase() + t.slice(1)}{" "}
                </option>
              ))}{" "}
            </select>{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Author{" "}
            </label>{" "}
            <input
              name="author"
              defaultValue={resource.author || ""}
              disabled={editType !== "book"}
              placeholder={
                editType === "book" ? "Author" : "Not used for this type"
              }
              className={`${darkFieldClass} disabled:cursor-not-allowed disabled:opacity-60`}
            />{" "}
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
              defaultValue={resource.url || ""}
              className={darkFieldClass}
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Notes{" "}
            </label>{" "}
            <textarea
              name="description"
              rows={2}
              defaultValue={resource.description || ""}
              className={darkFieldClass}
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Tags{" "}
            </label>{" "}
            <TagInput
              value={editTags}
              onChange={setEditTags}
              allTags={allTags}
              placeholder="Type a tag and press Enter"
            />{" "}
          </div>{" "}
          {editType === "book" && (
            <div>
              {" "}
              <label className="mb-1 block text-sm font-medium text-secondary">
                {" "}
                Assign to Booklists{" "}
              </label>{" "}
              <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                {" "}
                {booklists.length === 0 ? (
                  <p className="text-xs text-muted">
                    No booklists available yet.
                  </p>
                ) : (
                  booklists.map((booklist) => (
                    <label
                      key={booklist.id}
                      className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-surface-muted"
                    >
                      {" "}
                      <input
                        type="checkbox"
                        checked={selectedBooklistIds.includes(booklist.id)}
                        onChange={() => toggleBooklist(booklist.id)}
                        className="rounded border-border text-interactive focus:ring-focus"
                      />{" "}
                      <span>{booklist.name}</span>{" "}
                    </label>
                  ))
                )}{" "}
              </div>{" "}
            </div>
          )}{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Cover Photo <span className="text-muted">(optional)</span>{" "}
            </label>{" "}
            {resource.thumbnail_url && !clearThumbnail && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-light p-2">
                {" "}
                {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                <img
                  src={resource.thumbnail_url}
                  alt={resource.title}
                  className="h-14 w-10 rounded-md border border-slate bg-transparent object-contain p-1"
                />{" "}
                <span className="text-xs text-muted">
                  Current cover image
                </span>{" "}
              </div>
            )}{" "}
            <input
              type="file"
              name="thumbnail_file"
              accept="image/*"
              className={darkFileClass}
            />{" "}
            {resource.thumbnail_url && (
              <label className="mt-2 flex items-center gap-2 text-xs text-tertiary">
                {" "}
                <input
                  type="checkbox"
                  checked={clearThumbnail}
                  onChange={(e) => setClearThumbnail(e.target.checked)}
                />{" "}
                Remove current cover image{" "}
              </label>
            )}{" "}
          </div>{" "}
          <div className="flex justify-end gap-2">
            {" "}
            <button
              type="button"
              onClick={() => setShowEdit(false)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
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
              {isPending ? "Saving..." : "Save Changes"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </Modal>{" "}
      {/* Attach Modal */}{" "}
      <Modal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setSelectedLessons([]);
          setLessonSearch("");
        }}
        title="Attach to Lessons"
      >
        {" "}
        <div className="space-y-4">
          {" "}
          <input
            type="text"
            placeholder="Search lessons..."
            value={lessonSearch}
            onChange={(e) => setLessonSearch(e.target.value)}
            className={darkFieldClass}
          />{" "}
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {" "}
            {filteredAvailable.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted">
                {" "}
                No available lessons{" "}
              </p>
            ) : (
              filteredAvailable.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-surface-muted"
                >
                  {" "}
                  <input
                    type="checkbox"
                    checked={selectedLessons.includes(l.id)}
                    onChange={() => toggleLesson(l.id)}
                    className="rounded border-border text-interactive focus:ring-focus"
                  />{" "}
                  <div className="min-w-0 flex-1">
                    {" "}
                    <p className="text-sm font-medium text-primary truncate">
                      {" "}
                      {l.title}{" "}
                    </p>{" "}
                    <p className="text-xs text-muted">
                      {" "}
                      {l.subject_name} · {l.child_name}{" "}
                    </p>{" "}
                  </div>{" "}
                </label>
              ))
            )}{" "}
          </div>{" "}
          {selectedLessons.length > 0 && (
            <p className="text-xs text-muted">
              {" "}
              {selectedLessons.length} selected{" "}
            </p>
          )}{" "}
          <div className="flex justify-end gap-2">
            {" "}
            <button
              type="button"
              onClick={() => {
                setShowAttach(false);
                setSelectedLessons([]);
              }}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              {" "}
              Cancel{" "}
            </button>{" "}
            <button
              onClick={handleAttach}
              disabled={isPending || selectedLessons.length === 0}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              {isPending
                ? "Attaching..."
                : `Attach (${selectedLessons.length})`}{" "}
            </button>{" "}
          </div>{" "}
        </div>{" "}
      </Modal>{" "}
      {/* Delete Confirmation */}{" "}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Resource"
      >
        {" "}
        <p className="mb-4 text-sm text-tertiary">
          {" "}
          Are you sure you want to delete &quot;{resource.title}&quot;? This
          will unlink it from all lessons.{" "}
        </p>{" "}
        <div className="flex justify-end gap-2">
          {" "}
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
          >
            {" "}
            Cancel{" "}
          </button>{" "}
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {" "}
            {isPending ? "Deleting..." : "Delete"}{" "}
          </button>{" "}
        </div>{" "}
      </Modal>{" "}
      <ResourcePreviewModal
        open={showPreview}
        onClose={() => setShowPreview(false)}
        title={resource.title}
        type={resource.type}
        url={resource.url || null}
        thumbnailUrl={resource.thumbnail_url}
      />{" "}
    </>
  );
}
