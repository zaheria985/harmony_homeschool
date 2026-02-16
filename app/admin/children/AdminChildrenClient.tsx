"use client";
import { useState } from "react";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import ViewToggle from "@/components/ui/ViewToggle";
import { createChild, updateChild, deleteChild } from "@/lib/actions/students";
import { useRouter } from "next/navigation";
type Child = {
  id: string;
  name: string;
  emoji: string | null;
  banner_url: string | null;
  subject_count: number;
  total_lessons: number;
  completed_lessons: number;
};
export default function AdminChildrenClient({
  children,
}: {
  children: Child[];
}) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<Child | null>(null);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [clearBanner, setClearBanner] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Child | null>(null);
  const [view, setView] = useState("table");
  function openCreate() {
    setEditingChild(null);
    setName("");
    setEmoji("");
    setBannerUrl("");
    setBannerFile(null);
    setClearBanner(false);
    setError("");
    setModalOpen(true);
  }
  function openEdit(child: Child) {
    setEditingChild(child);
    setName(child.name);
    setEmoji(child.emoji || "");
    setBannerUrl(child.banner_url || "");
    setBannerFile(null);
    setClearBanner(false);
    setError("");
    setModalOpen(true);
  }
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const formData = new FormData();
    formData.set("name", name);
    formData.set("emoji", emoji);
    formData.set("banner_url", bannerUrl);
    formData.set("clear_banner", clearBanner ? "true" : "false");
    if (bannerFile) {
      formData.set("banner_file", bannerFile);
    }
    if (editingChild) {
      formData.set("id", editingChild.id);
      const result = await updateChild(formData);
      if ("error" in result) {
        setError(result.error || "Failed to update child");
        setSubmitting(false);
        return;
      }
    } else {
      const result = await createChild(formData);
      if ("error" in result) {
        setError(result.error || "Failed to create child");
        setSubmitting(false);
        return;
      }
    }
    setSubmitting(false);
    setModalOpen(false);
    router.refresh();
  }
  async function handleDelete(child: Child) {
    setSubmitting(true);
    const result = await deleteChild(child.id);
    if ("error" in result) {
      setError(result.error || "Failed to delete child");
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
          + Add Child{" "}
        </button>{" "}
      </div>{" "}
      <div className="mb-4 flex justify-end">
        {" "}
        <ViewToggle
          storageKey="admin-children-view"
          options={[
            { key: "gallery", label: "Gallery" },
            { key: "table", label: "Table" },
          ]}
          defaultView="table"
          onChange={setView}
        />{" "}
      </div>{" "}
      {children.length === 0 ? (
        <EmptyState message="No children added yet" icon="👨‍🎓" />
      ) : view === "gallery" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {" "}
          {children.map((child) => (
            <div
              key={child.id}
              className="rounded-xl border border-light bg-surface p-4 shadow-sm"
            >
              {" "}
              {child.banner_url && (
                <div className="mb-3 h-24 overflow-hidden rounded-lg border border-light bg-surface-muted">
                  {" "}
                  {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                  <img
                    src={child.banner_url}
                    alt={child.name}
                    className="h-full w-full object-cover"
                  />{" "}
                </div>
              )}{" "}
              <div className="mb-2 flex items-center justify-between">
                {" "}
                <h3 className="text-sm font-semibold text-primary">
                  {" "}
                  {child.emoji ? `${child.emoji}` : ""} {child.name}{" "}
                </h3>{" "}
              </div>{" "}
              <p className="text-xs text-muted">
                {" "}
                {child.subject_count} subjects · {child.completed_lessons}/
                {child.total_lessons} lessons completed{" "}
              </p>{" "}
              <div className="mt-3 flex gap-2">
                {" "}
                <button
                  onClick={() => openEdit(child)}
                  className="rounded border border-border px-2 py-1 text-xs text-interactive hover:bg-interactive-light"
                >
                  {" "}
                  Edit{" "}
                </button>{" "}
                <button
                  onClick={() => setConfirmDelete(child)}
                  className="rounded border border-[var(--error-border)] px-2 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)] dark:border-red-800/60 dark:text-red-300 dark:hover:bg-red-900/30"
                >
                  {" "}
                  Delete{" "}
                </button>{" "}
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
                  <th className="pb-3 font-medium">Name</th>{" "}
                  <th className="pb-3 font-medium">Subjects</th>{" "}
                  <th className="pb-3 font-medium">Lessons</th>{" "}
                  <th className="pb-3 font-medium">Completed</th>{" "}
                  <th className="pb-3 text-right font-medium">Actions</th>{" "}
                </tr>{" "}
              </thead>{" "}
              <tbody>
                {" "}
                {children.map((child) => (
                  <tr
                    key={child.id}
                    className="border-b border-light last:border-0"
                  >
                    {" "}
                    <td className="py-3 font-medium text-primary">
                      {" "}
                      {child.emoji && (
                        <span className="mr-1">{child.emoji}</span>
                      )}{" "}
                      {child.name}{" "}
                    </td>{" "}
                    <td className="py-3 text-tertiary">
                      {child.subject_count}
                    </td>{" "}
                    <td className="py-3 text-tertiary">
                      {child.total_lessons}
                    </td>{" "}
                    <td className="py-3 text-tertiary">
                      {child.completed_lessons}
                    </td>{" "}
                    <td className="py-3 text-right">
                      {" "}
                      <button
                        onClick={() => openEdit(child)}
                        aria-label={`Edit child ${child.name}`}
                        className="mr-2 rounded px-2 py-1 text-xs text-interactive hover:bg-interactive-light"
                      >
                        {" "}
                        Edit{" "}
                      </button>{" "}
                      <button
                        onClick={() => setConfirmDelete(child)}
                        aria-label={`Delete child ${child.name}`}
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
        title={editingChild ? "Edit Child" : "Add Child"}
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
              placeholder="Child's name"
              autoFocus
            />{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Emoji{" "}
              <span className="text-muted">
                (optional)
              </span>{" "}
            </label>{" "}
            {emoji ? (
              <div className="flex items-center gap-2">
                <span className="text-2xl">{emoji}</span>
                <button
                  type="button"
                  onClick={() => setEmoji("")}
                  className="rounded border border-border px-2 py-1 text-xs text-tertiary hover:bg-surface-muted"
                >
                  Clear
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-10 gap-1 rounded-lg border border-border bg-surface p-2">
                {["🎓","📚","✏️","🌟","⭐","💫","🦊","🐱","🐶","🐰","🦁","🐻","🐼","🦄","🐝","🦋","🌈","🌻","🎨","🎵","🏀","⚽","🎯","🚀","💡","🔬","🌍","❤️","💜","🩵"].map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    className="rounded p-1 text-lg hover:bg-surface-muted"
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}{" "}
          </div>{" "}
          <div>
            {" "}
            <label className="mb-1 block text-sm font-medium text-secondary">
              {" "}
              Banner Photo{" "}
              <span className="text-muted">
                (optional)
              </span>{" "}
            </label>{" "}
            {bannerUrl && !clearBanner && !bannerFile && (
              <div className="mb-2 rounded-lg border border-light bg-surface-muted p-2">
                {" "}
                {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
                <img
                  src={bannerUrl}
                  alt={`${name || "Child"} banner`}
                  className="h-20 w-full rounded object-cover"
                />{" "}
              </div>
            )}{" "}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                setBannerFile(e.target.files?.[0] || null);
                if (e.target.files?.[0]) setClearBanner(false);
              }}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary"
            />{" "}
            {bannerUrl && (
              <label className="mt-2 flex items-center gap-2 text-xs text-tertiary">
                {" "}
                <input
                  type="checkbox"
                  checked={clearBanner}
                  onChange={(e) => {
                    setClearBanner(e.target.checked);
                    if (e.target.checked) setBannerFile(null);
                  }}
                />{" "}
                Remove current banner{" "}
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
              {submitting
                ? "Saving..."
                : editingChild
                  ? "Update"
                  : "Create"}{" "}
            </button>{" "}
          </div>{" "}
        </form>{" "}
      </Modal>{" "}
      {/* Delete Confirmation Modal */}{" "}
      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete Child"
      >
        {" "}
        <p className="mb-2 text-sm text-tertiary">
          {" "}
          Are you sure you want to delete <strong>{confirmDelete?.name}</strong>
          ?{" "}
        </p>{" "}
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">
          {" "}
          This will permanently delete all their subjects, curricula, lessons,
          and completions.{" "}
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
