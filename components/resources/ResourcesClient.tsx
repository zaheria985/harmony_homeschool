"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import RowActions from "@/components/ui/RowActions";
import { Package } from "lucide-react";
import ViewToggle from "@/components/ui/ViewToggle";
import { createGlobalResource, bulkDeleteResources, bulkAddTagsToResources } from "@/lib/actions/resources";
import BulkResourceImportModal from "@/components/resources/BulkResourceImportModal";

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

const RESOURCE_TYPES = ["book", "video", "pdf", "link", "supply", "local_file"] as const;

const typeIcons: Record<string, string> = {
  book: "📕",
  video: "🎬",
  pdf: "📄",
  link: "🔗",
  supply: "🧰",
  local_file: "📝",
};

const typeBadgeVariant: Record<string, string> = {
  book: "primary",
  video: "warning",
  pdf: "danger",
  link: "info",
  supply: "default",
  local_file: "success",
};

function isImageUrl(url: string | null): boolean {
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg|avif)(\?.*)?$/i.test(url);
}

export default function ResourcesClient({
  resources,
  initialTypeFilter = "",
  initialSearch = "",
  initialTagFilter = "",
  initialCategory = "learning",
}: {
  resources: Resource[];
  booklists?: Booklist[];
  initialTypeFilter?: string;
  initialSearch?: string;
  initialTagFilter?: string;
  initialCategory?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);
  const [category, setCategory] = useState(initialCategory);
  const allTypes = useMemo(() => {
    const types = new Set<string>();
    for (const r of resources) types.add(r.type);
    return Array.from(types).sort();
  }, [resources]);
  const [activeTypes, setActiveTypes] = useState<Set<string>>(() => new Set(allTypes));
  const [tagFilter, setTagFilter] = useState(initialTagFilter);
  const [view, setView] = useState("table");
  const [showCreate, setShowCreate] = useState(false);
  const [createType, setCreateType] = useState("book");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [showBulkTag, setShowBulkTag] = useState(false);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [isTagging, setIsTagging] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);

  const allExistingTags = useMemo(() => {
    const set = new Set<string>();
    for (const r of resources) {
      if (r.tags) for (const t of r.tags) set.add(t);
    }
    return Array.from(set).sort();
  }, [resources]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleType = useCallback((type: string) => {
    setActiveTypes(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }, []);

  const filtered = resources.filter((r) => {
    if (!activeTypes.has(r.type)) return false;
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

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === filtered.length) return new Set();
      return new Set(filtered.map((r) => r.id));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered.length, filtered]);

  async function handleDeleteResource(id: string) {
    setError("");
    startTransition(async () => {
      const result = await bulkDeleteResources([id]);
      if ("error" in result && result.error) {
        setError(result.error);
      }
      router.refresh();
    });
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!confirm(`Delete ${count} selected resource${count === 1 ? "" : "s"}? This cannot be undone.`)) return;
    setError("");
    setIsDeleting(true);
    try {
      const result = await bulkDeleteResources(Array.from(selectedIds));
      if ("error" in result && result.error) {
        setError(result.error);
      } else {
        setSelectedIds(new Set());
      }
    } catch (err) {
      setError("Failed to delete resources. Please try again.");
      console.error("Bulk delete error:", err);
    } finally {
      setIsDeleting(false);
      router.refresh();
    }
  }

  async function handleBulkTag() {
    if (selectedIds.size === 0 || !bulkTagInput.trim()) return;
    const tagNames = bulkTagInput.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
    if (tagNames.length === 0) return;
    setIsTagging(true);
    const result = await bulkAddTagsToResources(Array.from(selectedIds), tagNames);
    setIsTagging(false);
    if (result && "error" in result) {
      setError(result.error || "Failed to tag resources");
    } else {
      setBulkTagInput("");
      setShowBulkTag(false);
      router.refresh();
    }
  }

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
        <div className="flex flex-wrap items-center gap-3">
          {allTypes.map((type) => (
            <label key={type} className="flex cursor-pointer items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                checked={activeTypes.has(type)}
                onChange={() => toggleType(type)}
                className="rounded border-border text-interactive focus:ring-focus"
              />
              {typeIcons[type] || "📎"} {type}
            </label>
          ))}
          <button
            type="button"
            onClick={() => setActiveTypes(prev => prev.size === allTypes.length ? new Set() : new Set(allTypes))}
            className="text-xs text-interactive hover:underline"
          >
            {activeTypes.size === allTypes.length ? "Deselect all" : "Select all"}
          </button>
        </div>

        <input
          type="text"
          placeholder="Tag"
          value={tagFilter}
          onChange={(e) => setTagFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
        />

        <select
          value={category}
          onChange={(e) => {
            setCategory(e.target.value);
            const params = new URLSearchParams(window.location.search);
            params.set("category", e.target.value);
            router.push(`/resources?${params.toString()}`);
          }}
          className="rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus"
          aria-label="Filter by category"
        >
          <option value="learning">Learning Resources</option>
          <option value="asset">Assets</option>
          <option value="all">All</option>
        </select>

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
            type="button"
            onClick={() => setShowBulkImport(true)}
            className="rounded-lg border border-light bg-surface px-4 py-2 text-sm font-medium text-secondary hover:bg-surface-muted"
          >
            Bulk Import
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
          >
            + New Resource
          </button>
        </div>
      </div>

      {error && (
        <p className="mb-3 rounded-lg bg-[var(--error-bg)] px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Bulk actions bar */}
      {filtered.length > 0 && (
        <div className="mb-4 flex items-center gap-3">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="rounded-lg border border-light px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface-muted"
          >
            {selectedIds.size === filtered.length ? "Deselect all" : "Select all"}
          </button>
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {isDeleting
                ? "Deleting..."
                : `Delete selected (${selectedIds.size})`}
            </button>
          )}
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setShowBulkTag(!showBulkTag)}
              className="rounded-lg border border-light bg-surface px-3 py-1.5 text-xs font-medium text-secondary hover:bg-surface-muted"
            >
              Tag selected ({selectedIds.size})
            </button>
          )}
          {selectedIds.size > 0 && (
            <span className="text-xs text-muted">
              {selectedIds.size} of {filtered.length} selected
            </span>
          )}
          {showBulkTag && selectedIds.size > 0 && (
            <div className="flex w-full items-center gap-2 pt-1">
              <input
                value={bulkTagInput}
                onChange={(e) => setBulkTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleBulkTag(); } }}
                placeholder="tag1, tag2, ..."
                list="bulk-tag-suggestions"
                className="flex-1 rounded-lg border border-light bg-surface px-3 py-1.5 text-sm text-primary placeholder:text-muted focus:outline-none focus:ring-1 focus:ring-focus"
              />
              <datalist id="bulk-tag-suggestions">
                {allExistingTags.map(t => <option key={t} value={t} />)}
              </datalist>
              <button
                type="button"
                onClick={handleBulkTag}
                disabled={isTagging || !bulkTagInput.trim()}
                className="rounded-lg bg-interactive px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {isTagging ? "..." : "Apply"}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState message="No resources found" icon={<Package size={28} />} />
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-2xl border border-light bg-surface shadow-warm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-muted text-xs uppercase text-muted">
              <tr>
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300"
                    aria-label="Select all resources"
                  />
                </th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Used in</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className={`hover:bg-surface-muted ${selectedIds.has(r.id) ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelect(r.id)}
                      className="rounded border-gray-300"
                      aria-label={`Select ${r.title}`}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/resources/${r.id}`}
                      className="font-medium text-interactive hover:underline"
                    >
                      {r.title}
                    </Link>
                    {isImageUrl(r.url) && r.url && (
                      <div className="mt-1">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={r.url} alt={r.title} className="h-16 w-auto rounded object-contain" />
                      </div>
                    )}
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
                  <td className="px-4 py-3">
                    <RowActions
                      onView={() => router.push(`/resources/${r.id}`)}
                      onDelete={() => handleDeleteResource(r.id)}
                      deleteWarning={r.usage_count > 0 ? `This resource is linked to ${r.usage_count} lesson${r.usage_count === 1 ? "" : "s"}. It will be unlinked.` : undefined}
                      disabled={isPending}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((r) => (
            <div
              key={r.id}
              className={`relative flex h-full flex-col rounded-2xl border bg-surface shadow-warm transition-shadow hover:shadow-warm-md ${selectedIds.has(r.id) ? "border-blue-400 ring-2 ring-blue-200" : "border-light"}`}
            >
              <div className="absolute left-2 top-2 z-10">
                <input
                  type="checkbox"
                  checked={selectedIds.has(r.id)}
                  onChange={() => toggleSelect(r.id)}
                  className="h-4 w-4 rounded border-gray-300 shadow-sm"
                  aria-label={`Select ${r.title}`}
                />
              </div>
              <Link
                href={`/resources/${r.id}`}
                className="flex h-full flex-col"
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
                ) : isImageUrl(r.url) && r.url ? (
                  <div className="overflow-hidden rounded-t-2xl border-b border-light">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={r.url}
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
            </div>
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
                  {t === "local_file" ? "Local File" : t.charAt(0).toUpperCase() + t.slice(1)}
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

      <BulkResourceImportModal
        open={showBulkImport}
        onClose={() => {
          setShowBulkImport(false);
          router.refresh();
        }}
      />
    </>
  );
}
