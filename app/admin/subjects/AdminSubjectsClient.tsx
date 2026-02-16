"use client";
import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { BookOpen } from "lucide-react";
import ViewToggle from "@/components/ui/ViewToggle";
import {
  createSubject,
  updateSubject,
  deleteSubject,
} from "@/lib/actions/lessons";
import { useRouter } from "next/navigation";
const COLOR_OPTIONS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#a855f7", label: "Purple" },
  { value: "#f97316", label: "Orange" },
  { value: "#14b8a6", label: "Teal" },
];
type Subject = {
  id: string;
  name: string;
  color: string | null;
  thumbnail_url: string | null;
  curriculum_count: number;
  lesson_count: number;
};
export default function AdminSubjectsClient({
  subjects,
}: {
  subjects: Subject[];
}) {
  const router = useRouter();
  const [localSubjects, setLocalSubjects] = useState<Subject[]>(subjects);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [clearThumbnail, setClearThumbnail] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Subject | null>(null);
  const [thumbnailVersionById, setThumbnailVersionById] = useState<
    Record<string, number>
  >({});
  const [view, setView] = useState("table");
  useEffect(() => {
    setLocalSubjects(subjects);
  }, [subjects]);
  function withCacheBust(url: string | null, id: string | null) {
    if (!url) return "";
    if (!id) return url;
    const version = thumbnailVersionById[id];
    if (!version) return url;
    return `${url}${url.includes("?") ? "&" : "?"}v=${version}`;
  }
  function openCreate() {
    setEditing(null);
    setName("");
    setColor("#6366f1");
    setThumbnailFile(null);
    setClearThumbnail(false);
    setError("");
    setModalOpen(true);
  }
  function openEdit(subject: Subject) {
    setEditing(subject);
    setName(subject.name);
    setColor(subject.color || "#6366f1");
    setThumbnailFile(null);
    setClearThumbnail(false);
    setError("");
    setModalOpen(true);
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("color", color);
    formData.set("clear_thumbnail", clearThumbnail ? "true" : "false");
    if (thumbnailFile) {
      formData.set("thumbnail_file", thumbnailFile);
    }
    if (editing) {
      formData.set("id", editing.id);
      if (editing.thumbnail_url) {
        formData.set("thumbnail_url", editing.thumbnail_url);
      }
      const result = await updateSubject(formData);
      if ("error" in result) {
        setError(result.error || "Failed to save subject");
        setSubmitting(false);
        return;
      }
      const nextThumbnailUrl = clearThumbnail
        ? null
        : thumbnailFile
          ? (result.thumbnail_url ?? editing.thumbnail_url)
          : editing.thumbnail_url;
      setLocalSubjects((current) =>
        current.map((subject) =>
          subject.id === editing.id
            ? { ...subject, name, color, thumbnail_url: nextThumbnailUrl }
            : subject,
        ),
      );
      if (thumbnailFile || clearThumbnail) {
        setThumbnailVersionById((current) => ({
          ...current,
          [editing.id]: Date.now(),
        }));
      }
      setEditing((current) =>
        current
          ? { ...current, name, color, thumbnail_url: nextThumbnailUrl }
          : current,
      );
    } else {
      const result = await createSubject(formData);
      if ("error" in result) {
        setError(result.error || "Failed to create subject");
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    setModalOpen(false);
    router.refresh();
  }
  async function handleDelete(subject: Subject) {
    setSubmitting(true);
    const result = await deleteSubject(subject.id);
    if ("error" in result) {
      setError(result.error || "Failed to delete subject");
    }
    setSubmitting(false);
    setConfirmDelete(null);
    router.refresh();
  }
  return (
    <>
      {" "}
      <div className="mb-4 flex justify-end">
        {" "}
        <button
          onClick={openCreate}
          className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
        >
          {" "}
          + Add Subject{" "}
        </button>{" "}
      </div>{" "}
      <div className="mb-4 flex justify-end">
        {" "}
        <ViewToggle
          storageKey="admin-subjects-view"
          options={[
            { key: "gallery", label: "Gallery" },
            { key: "table", label: "Table" },
          ]}
          defaultView="table"
          onChange={setView}
        />{" "}
      </div>{" "}
      {localSubjects.length === 0 ? (
        <EmptyState message="No subjects added yet" icon={<BookOpen size={28} />} />
      ) : view === "gallery" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {" "}
          {localSubjects.map((subject) => (
            <div
              key={subject.id}
              className="rounded-2xl border border-light bg-surface shadow-warm"
            >
              {" "}
              <div
                className="h-2 rounded-t-2xl"
                style={{
                  backgroundColor: subject.color || "#6366f1",
                }}
              />{" "}
              {subject.thumbnail_url && (
                <div className="aspect-[2005/880] overflow-hidden border-b border-light">
                  {" "}
                  {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                  <img
                    src={withCacheBust(subject.thumbnail_url, subject.id)}
                    alt={subject.name}
                    className="h-full w-full object-cover"
                  />{" "}
                </div>
              )}{" "}
              <div className="p-4">
                {" "}
                <h3 className="text-sm font-semibold text-primary">
                  {subject.name}
                </h3>{" "}
                <p className="mt-1 text-xs text-muted">
                  {" "}
                  {subject.curriculum_count} courses · {subject.lesson_count}{" "}
                  lessons{" "}
                </p>{" "}
                <div className="mt-3 flex gap-2">
                  {" "}
                  <button
                    onClick={() => openEdit(subject)}
                    className="rounded border border-border px-2 py-1 text-xs text-interactive hover:bg-interactive-light"
                  >
                    {" "}
                    Edit{" "}
                  </button>{" "}
                  <button
                    onClick={() => setConfirmDelete(subject)}
                    className="rounded border border-[var(--error-border)] px-2 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)] dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/30"
                  >
                    {" "}
                    Delete{" "}
                  </button>{" "}
                </div>{" "}
              </div>{" "}
            </div>
          ))}{" "}
        </div>
      ) : (
        <Card>
          {" "}
          <div className="overflow-x-auto">
            {" "}
            <table className="w-full text-left text-sm">
              {" "}
              <thead>
                {" "}
                <tr className="border-b border-light text-muted">
                  {" "}
                  <th className="pb-3 font-medium">Color</th>{" "}
                  <th className="pb-3 font-medium">Name</th>{" "}
                  <th className="pb-3 font-medium">Courses</th>{" "}
                  <th className="pb-3 font-medium">Lessons</th>{" "}
                  <th className="pb-3 text-right font-medium">Actions</th>{" "}
                </tr>{" "}
              </thead>{" "}
              <tbody>
                {" "}
                {localSubjects.map((subject) => (
                  <tr
                    key={subject.id}
                    className="border-b border-light last:border-0"
                  >
                    {" "}
                    <td className="py-3">
                      {" "}
                      <span
                        className="inline-block h-4 w-4 rounded-full"
                        style={{ backgroundColor: subject.color || "#6366f1" }}
                      />{" "}
                    </td>{" "}
                    <td className="py-3 font-medium text-primary">
                      {subject.name}
                    </td>{" "}
                    <td className="py-3 text-tertiary">
                      {subject.curriculum_count}
                    </td>{" "}
                    <td className="py-3 text-tertiary">
                      {subject.lesson_count}
                    </td>{" "}
                    <td className="py-3 text-right">
                      {" "}
                      <button
                        onClick={() => openEdit(subject)}
                        aria-label={`Edit subject ${subject.name}`}
                        className="mr-2 rounded px-2 py-1 text-xs text-interactive hover:bg-interactive-light"
                      >
                        {" "}
                        Edit{" "}
                      </button>{" "}
                      <button
                        onClick={() => setConfirmDelete(subject)}
                        aria-label={`Delete subject ${subject.name}`}
                        className="rounded px-2 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)] dark:text-red-300 dark:hover:bg-red-900/30"
                      >
                        {" "}
                        Delete{" "}
                      </button>{" "}
                    </td>{" "}
                  </tr>
                ))}{" "}
              </tbody>{" "}
            </table>{" "}
          </div>{" "}
        </Card>
      )}{" "}
      {/* Create/Edit Modal */}{" "}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit Subject" : "Add Subject"}
      >
        {" "}
        <form onSubmit={handleSubmit} className="space-y-4">
          {" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Name
            </label>{" "}
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
              required
              placeholder="e.g. Math, Science, History"
              autoFocus
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              Color
            </label>{" "}
            <div className="flex flex-wrap gap-2">
              {" "}
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setColor(c.value)}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${color === c.value ? "border-primary-500 bg-interactive-light font-medium dark:text-primary-200" : "border-light hover:bg-surface-muted"}`}
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full"
                    style={{ backgroundColor: c.value }}
                  />
                  {c.label}
                </button>
              ))}{" "}
            </div>{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Subject Photo{" "}
              <span className="text-muted">
                (optional)
              </span>{" "}
            </label>{" "}
            {editing?.thumbnail_url && !clearThumbnail && !thumbnailFile && (
              <div className="mb-2 flex items-center gap-2 rounded-lg border border-light p-2">
                {" "}
                {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                <img
                  src={withCacheBust(editing.thumbnail_url, editing.id)}
                  alt={editing.name}
                  className="h-10 w-10 rounded border border-light bg-transparent object-cover"
                />{" "}
                <span className="text-xs text-muted">
                  Current image
                </span>{" "}
              </div>
            )}{" "}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setThumbnailFile(e.target.files?.[0] || null);
                if (e.target.files?.[0]) setClearThumbnail(false);
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
            />{" "}
            {editing?.thumbnail_url && (
              <label className="mt-2 flex items-center gap-2 text-xs text-tertiary">
                {" "}
                <input
                  type="checkbox"
                  checked={clearThumbnail}
                  onChange={(e) => {
                    setClearThumbnail(e.target.checked);
                    if (e.target.checked) setThumbnailFile(null);
                  }}
                />{" "}
                Remove current photo{" "}
              </label>
            )}{" "}
          </div>{" "}
          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}{" "}
          <div className="flex justify-end gap-3 pt-2">
            {" "}
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              {" "}
              Cancel{" "}
            </button>{" "}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {" "}
              {submitting ? "Saving..." : editing ? "Update" : "Create"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </Modal>{" "}
      {/* Delete Confirmation */}{" "}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Subject"
      >
        {" "}
        <p className="mb-2 text-sm text-tertiary">
          {" "}
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>
          ?{" "}
        </p>{" "}
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {" "}
          This will permanently delete all curricula and lessons within this
          subject.{" "}
        </p>{" "}
        <div className="flex justify-end gap-3">
          {" "}
          <button
            onClick={() => setConfirmDelete(null)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
          >
            {" "}
            Cancel{" "}
          </button>{" "}
          <button
            onClick={() => confirmDelete && handleDelete(confirmDelete)}
            disabled={submitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {" "}
            {submitting ? "Deleting..." : "Delete"}{" "}
          </button>{" "}
        </div>{" "}
      </Modal>{" "}
    </>
  );
}
