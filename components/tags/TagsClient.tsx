"use client";
import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createTag, deleteTag, mergeTags, renameTag } from "@/lib/actions/tags";

type TagItem = { id: string; name: string; resource_count: number };

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

export default function TagsClient({
  tags,
  userRole = "parent",
}: {
  tags: TagItem[];
  userRole?: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [renameValue, setRenameValue] = useState<Record<string, string>>({});
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});

  const isParent = userRole !== "kid";

  const filtered = useMemo(
    () =>
      tags.filter(
        (tag) =>
          !search || tag.name.toLowerCase().includes(search.toLowerCase()),
      ),
    [search, tags],
  );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter tags..."
          className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted"
        />
        {isParent && (
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!newTagName.trim()) return;
              startTransition(async () => {
                const res = await createTag(newTagName.trim());
                if ("error" in res)
                  setError(res.error || "Failed to create tag");
                else {
                  setNewTagName("");
                  setError("");
                  router.refresh();
                }
              });
            }}
          >
            <input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="New tag name..."
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted"
            />
            <button
              type="submit"
              disabled={isPending || !newTagName.trim()}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              + New Tag
            </button>
          </form>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No tags found.</p>
      ) : isParent ? (
        <div className="overflow-x-auto rounded-2xl border border-light bg-surface shadow-warm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-surface-muted text-xs uppercase text-muted">
              <tr>
                <th className="px-4 py-3">Tag</th>
                <th className="px-4 py-3">Resources</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((tag) => (
                <tr key={tag.id} className="hover:bg-surface-muted">
                  <td className="px-4 py-3">
                    <Link
                      href={`/resources?tag=${encodeURIComponent(tag.name)}`}
                      className="inline-flex items-center gap-2"
                    >
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styleForTag(tag.name)}`}
                      >
                        {tag.name}
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {tag.resource_count}{" "}
                    {tag.resource_count === 1 ? "resource" : "resources"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        value={renameValue[tag.id] ?? tag.name}
                        onChange={(e) =>
                          setRenameValue((prev) => ({
                            ...prev,
                            [tag.id]: e.target.value,
                          }))
                        }
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-primary"
                      />
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            const val = renameValue[tag.id] ?? tag.name;
                            if (val === tag.name) return;
                            const res = await renameTag(tag.id, val);
                            if ("error" in res)
                              setError(res.error || "Failed to rename");
                            else {
                              setError("");
                              router.refresh();
                            }
                          })
                        }
                        disabled={isPending}
                        className="rounded-lg border border-border px-2 py-1 text-xs text-secondary hover:bg-surface-muted"
                      >
                        Rename
                      </button>
                      <select
                        value={mergeTarget[tag.id] || ""}
                        onChange={(e) =>
                          setMergeTarget((prev) => ({
                            ...prev,
                            [tag.id]: e.target.value,
                          }))
                        }
                        className="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-primary"
                      >
                        <option value="">Merge into...</option>
                        {tags
                          .filter((candidate) => candidate.id !== tag.id)
                          .map((candidate) => (
                            <option key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </option>
                          ))}
                      </select>
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            const targetId = mergeTarget[tag.id];
                            if (!targetId) return;
                            const res = await mergeTags(tag.id, targetId);
                            if ("error" in res)
                              setError(res.error || "Failed to merge");
                            else {
                              setError("");
                              router.refresh();
                            }
                          })
                        }
                        disabled={isPending || !mergeTarget[tag.id]}
                        className="rounded-lg border border-border px-2 py-1 text-xs text-secondary hover:bg-surface-muted"
                      >
                        Merge
                      </button>
                      <button
                        onClick={() =>
                          startTransition(async () => {
                            if (!confirm(`Delete tag '${tag.name}'?`)) return;
                            const res = await deleteTag(tag.id);
                            if ("error" in res)
                              setError(res.error || "Failed to delete");
                            else {
                              setError("");
                              router.refresh();
                            }
                          })
                        }
                        disabled={isPending}
                        className="rounded-lg border border-[var(--error-border)] px-2 py-1 text-xs text-red-600 hover:bg-[var(--error-bg)] dark:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tag) => (
            <Link
              key={tag.name}
              href={`/resources?tag=${encodeURIComponent(tag.name)}`}
              className="flex items-center justify-between rounded-lg border border-light bg-surface p-3 shadow-sm hover:border-interactive-border"
            >
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styleForTag(tag.name)}`}
              >
                {tag.name}
              </span>
              <span className="text-xs text-muted">
                {tag.resource_count}{" "}
                {tag.resource_count === 1 ? "resource" : "resources"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
