"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import ViewToggle from "@/components/ui/ViewToggle";
import { createGlobalResource } from "@/lib/actions/resources";

type Resource = {
  id: string;
  title: string;
  type: string;
  url: string | null;
  thumbnail_url: string | null;
  description: string | null;
  created_at: string;
  usage_count: number;
};

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
}: {
  resources: Resource[];
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [view, setView] = useState("table");
  const [showCreate, setShowCreate] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const filtered = resources.filter((r) => {
    if (typeFilter && r.type !== typeFilter) return false;
    if (
      search &&
      !r.title.toLowerCase().includes(search.toLowerCase()) &&
      !(r.description || "").toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  function handleCreate(formData: FormData) {
    setError("");
    startTransition(async () => {
      const result = await createGlobalResource(formData);
      if (result.error) {
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
          className="rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          <option value="">All types</option>
          {RESOURCE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
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
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
          >
            + New Resource
          </button>
        </div>
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState message="No resources found" icon="📦" />
      ) : view === "table" ? (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-gray-50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Used in</th>
                <th className="px-4 py-3">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/resources/${r.id}`}
                      className="font-medium text-primary-600 hover:underline"
                    >
                      {r.title}
                    </Link>
                    {r.description && (
                      <p className="mt-0.5 text-xs text-gray-400 line-clamp-1">
                        {r.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={typeBadgeVariant[r.type] as "default"}>
                      {typeIcons[r.type]} {r.type}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.usage_count} {r.usage_count === 1 ? "lesson" : "lessons"}
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/resources/${r.id}`}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xl">{typeIcons[r.type]}</span>
                <Badge variant={typeBadgeVariant[r.type] as "default"}>
                  {r.type}
                </Badge>
              </div>
              <h3 className="font-medium text-gray-900">{r.title}</h3>
              {r.description && (
                <p className="mt-1 text-xs text-gray-400 line-clamp-2">
                  {r.description}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500">
                Used in {r.usage_count}{" "}
                {r.usage_count === 1 ? "lesson" : "lessons"}
              </p>
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
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Title
            </label>
            <input
              name="title"
              required
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
              placeholder="https://..."
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
              className="w-full rounded-lg border px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create Resource"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
