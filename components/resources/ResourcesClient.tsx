"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import { Package } from "lucide-react";
import ViewToggle from "@/components/ui/ViewToggle";
import { createGlobalResource } from "@/lib/actions/resources";

type Resource = {
  id: string;
  title: string;
  type: string;
  author?: string | null;
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
  created_at: string;
  usage_count: number;
  tags?: string[];
  is_global?: boolean;
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

const typeBadgeVariant: Record<string, string> = {
  book: "primary",
  video: "warning",
  pdf: "danger",
  link: "info",
  supply: "default",
};

export default function ResourcesClient({
  resources,
  initialTypeFilter = "",
  initialSearch = "",
  initialTagFilter = "",
}: {
  resources: Resource[];
  booklists?: Booklist[];
  initialTypeFilter?: string;
  initialSearch?: string;
  initialTagFilter?: string;
}) {
  const [search, setSearch] = useState(initialSearch);
  const [typeFilter, setTypeFilter] = useState(initialTypeFilter);
  const [tagFilter, setTagFilter] = useState(initialTagFilter);
  const [view, setView] = useState("table");
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState("book");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const filtered = resources.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (tagFilter && !(r.tags || []).includes(tagFilter)) return false;
    if (
      search &&
      !r.title.toLowerCase().includes(search.toLowerCase()) &&
      !(r.description || "").toLowerCase().includes(search.toLowerCase()) &&
      !(r.author || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  function handleCreate(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createGlobalResource(formData);
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setShowCreate(false);
      }
    });
  }

  return (
    <>
      {/* Toolbar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search resources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
        >
          <option value="">All types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
        />

        <div className="ml-auto flex items-center gap-2">
          <ViewToggle
            storageKey="resources-view"
            options={[
              { key: "table", label: "Table" },
              { key: "gallery", label: "Gallery" },
            ]}
            defaultView="table"
            onChange={setView}
          />
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
          >
            + New Resource
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState message="No resources found" icon={<Package size={28} />} />
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-light bg-surface shadow-warm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-muted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Used in</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link
                      href={`/resources/${r.id}`}
                      className="font-medium text-interactive hover:underline"
                    >
                      {r.title}
                    </Link>
                    {r.description && (
                      <p className="mt-0.5 text-xs text-muted line-clamp-1">
                        {r.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={typeBadgeVariant[r.type] as "default"}>
                      {typeIcons[r.type]} {r.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-tertiary">
                    {r.usage_count} {r.usage_count === 1 ? "lesson" : "lessons"}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/resources/${r.id}`}
              className="flex h-full flex-col rounded-2xl border border-light bg-surface shadow-warm transition-shadow hover:shadow-warm-md"
            >
              {r.thumbnail_url ? (
                <div className="overflow-hidden rounded-t-2xl border-b border-light">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.thumbnail_url}
                    alt={r.title}
                    className="aspect-[3/4] w-full bg-transparent object-contain p-2"
                  />
                </div>
              ) : (
                <div className="flex aspect-[3/4] w-full items-center justify-center rounded-t-2xl border-b border-light text-4xl">
                  {typeIcons[r.type]}
                </div>
              )}
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2">
                  <Badge variant={typeBadgeVariant[r.type] as "default"}>
                    {r.type}
                  </Badge>
                </div>
                <h3 className="font-medium text-primary">{r.title}</h3>
                {r.description && (
                  <p className="mt-1 text-xs text-muted line-clamp-2">
                    {r.description}
                  </p>
                )}
                <p className="mt-2 text-xs text-muted">
                  Used in {r.usage_count}{" "}
                  {r.usage_count === 1 ? "lesson" : "lessons"}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Resource"
      >
        <form action={handleCreate} className="space-y-4">
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Title
            </label>
            <input
              name="title"
              required
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Type
            </label>
            <select
              name="type"
              required
              value={createType}
              onChange={(e) => setCreateType(e.target.value)}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
            >
              {RESOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>
          {createType === "book" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                Author
              </label>
              <input
                name="author"
                type="text"
                placeholder="Author name"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              URL
            </label>
            <input
              name="url"
              type="url"
              placeholder="https://..."
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>
          {createType === "book" && (
            <div>
              <label className="mb-1 block text-sm font-medium text-secondary">
                Thumbnail
              </label>
              <input
                name="thumbnail_file"
                type="file"
                accept="image/*"
                className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Description
            </label>
            <textarea
              name="description"
              rows={2}
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border px-4 py-2 text-sm text-tertiary hover:bg-surface-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create Resource"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
