"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
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
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
  created_at: string;
  lessons: Lesson[];
};

type AvailableLesson = {
  id: string;
  title: string;
  child_name: string;
  subject_name: string;
};

const RESOURCE_TYPES = ["book", "video", "pdf", "link", "supply"] as const;

const typeIcons: Record<string, string> = {
  book: "📕",
  video: "🎬",
  pdf: "📄",
  link: "🔗",
  supply: "🧰",
};

export default function ResourceDetailClient({
  resource,
  allLessons,
}: {
  resource: Resource;
  allLessons: AvailableLesson[];
}) {
  const router = useRouter();
  const [showEdit, setShowEdit] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedLessons, setSelectedLessons] = useState<string[]>([]);
  const [lessonSearch, setLessonSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const linkedLessonIds = new Set(resource.lessons.map((l) => l.id));
  const availableLessons = allLessons.filter(
    (l) => !linkedLessonIds.has(l.id)
  );
  const filteredAvailable = availableLessons.filter(
    (l) =>
      !lessonSearch ||
      l.title.toLowerCase().includes(lessonSearch.toLowerCase()) ||
      l.child_name.toLowerCase().includes(lessonSearch.toLowerCase()) ||
      l.subject_name.toLowerCase().includes(lessonSearch.toLowerCase())
  );

  function handleEdit(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await updateGlobalResource(formData);
      if (result.error) {
        setError(result.error);
      } else {
        setShowEdit(false);
      }
    });
  }

  function handleDelete() {
    startTransition(async () => {
      const result = await deleteGlobalResource(resource.id);
      if (result.error) {
        setError(result.error);
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
        selectedLessons
      );
      if (result.error) {
        setError(result.error);
      } else {
        setShowAttach(false);
        setSelectedLessons([]);
        setLessonSearch("");
      }
    });
  }

  function handleDetach(lessonId: string) {
    startTransition(async () => {
      await detachResourceFromLesson(resource.id, lessonId);
    });
  }

  function toggleLesson(id: string) {
    setSelectedLessons((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
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
      {/* Action buttons */}
      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setShowEdit(true)}
          className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
        >
          Edit
        </button>
        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
        <Link
          href="/resources"
          className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          Back to Resources
        </Link>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-gray-900">Details</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm text-gray-500">Type</dt>
              <dd>
                <Badge>
                  {typeIcons[resource.type]} {resource.type}
                </Badge>
              </dd>
            </div>
            {resource.url && (
              <div>
                <dt className="text-sm text-gray-500">URL</dt>
                <dd>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary-600 hover:underline break-all"
                  >
                    {resource.url}
                  </a>
                </dd>
              </div>
            )}
            {resource.description && (
              <div>
                <dt className="text-sm text-gray-500">Description</dt>
                <dd className="text-sm text-gray-700">{resource.description}</dd>
              </div>
            )}
            <div>
              <dt className="text-sm text-gray-500">Added</dt>
              <dd className="text-sm text-gray-700">
                {new Date(resource.created_at).toLocaleDateString()}
              </dd>
            </div>
          </dl>
        </div>

        {/* Linked Lessons */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Used in {resource.lessons.length}{" "}
              {resource.lessons.length === 1 ? "lesson" : "lessons"}
            </h3>
            <button
              onClick={() => setShowAttach(true)}
              className="rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              + Attach to Lessons
            </button>
          </div>
          {resource.lessons.length === 0 ? (
            <p className="text-sm text-gray-400">
              Not linked to any lessons yet
            </p>
          ) : (
            <ul className="space-y-2">
              {resource.lessons.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/lessons/${l.id}`}
                      className="text-sm font-medium text-primary-600 hover:underline"
                    >
                      {l.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                      {l.subject_color && (
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: l.subject_color }}
                        />
                      )}
                      <span>{l.subject_name}</span>
                      {l.child_name && (
                        <>
                          <span>·</span>
                          <span>{l.child_name}</span>
                        </>
                      )}
                      <Badge variant={statusVariant(l.status)}>
                        {l.status}
                      </Badge>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDetach(l.id)}
                    disabled={isPending}
                    className="ml-2 text-xs text-gray-400 hover:text-red-500"
                    title="Detach from lesson"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        open={showEdit}
        onClose={() => setShowEdit(false)}
        title="Edit Resource"
      >
        <form action={handleEdit} className="space-y-4">
          <input type="hidden" name="id" value={resource.id} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              name="title"
              required
              defaultValue={resource.title}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Type
            </label>
            <select
              name="type"
              required
              defaultValue={resource.type}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
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
              defaultValue={resource.url || ""}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              defaultValue={resource.description || ""}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowEdit(false)}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Attach Modal */}
      <Modal
        open={showAttach}
        onClose={() => {
          setShowAttach(false);
          setSelectedLessons([]);
          setLessonSearch("");
        }}
        title="Attach to Lessons"
      >
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Search lessons..."
            value={lessonSearch}
            onChange={(e) => setLessonSearch(e.target.value)}
            className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <div className="max-h-64 space-y-1 overflow-y-auto">
            {filteredAvailable.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                No available lessons
              </p>
            ) : (
              filteredAvailable.map((l) => (
                <label
                  key={l.id}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedLessons.includes(l.id)}
                    onChange={() => toggleLesson(l.id)}
                    className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {l.title}
                    </p>
                    <p className="text-xs text-gray-400">
                      {l.subject_name} · {l.child_name}
                    </p>
                  </div>
                </label>
              ))
            )}
          </div>
          {selectedLessons.length > 0 && (
            <p className="text-xs text-gray-500">
              {selectedLessons.length} selected
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setShowAttach(false);
                setSelectedLessons([]);
              }}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleAttach}
              disabled={isPending || selectedLessons.length === 0}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending
                ? "Attaching..."
                : `Attach (${selectedLessons.length})`}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <Modal
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Resource"
      >
        <p className="mb-4 text-sm text-gray-600">
          Are you sure you want to delete &quot;{resource.title}&quot;? This
          will unlink it from all lessons.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={() => setShowDeleteConfirm(false)}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={isPending}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isPending ? "Deleting..." : "Delete"}
          </button>
        </div>
      </Modal>
    </>
  );
}
