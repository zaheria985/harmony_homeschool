"use client";
import { useState, useTransition } from "react";
import { createTag, deleteTag, mergeTags, renameTag } from "@/lib/actions/tags";
import { useRouter } from "next/navigation";
type TagItem = { id: string; name: string; resource_count: number };
export default function AdminTagsClient({ tags }: { tags: TagItem[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [renameValue, setRenameValue] = useState<Record<string, string>>({});
  const [mergeTarget, setMergeTarget] = useState<Record<string, string>>({});
  const [newTagName, setNewTagName] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const filtered = tags.filter(
    (t) => !search || t.name.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <div className="space-y-4">
      {" "}
      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter tags..."
          className="max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted dark:placeholder:text-slate-400"
        />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!newTagName.trim()) return;
            startTransition(async () => {
              const res = await createTag(newTagName.trim());
              if ("error" in res) setError(res.error || "Failed to create tag");
              else {
                setNewTagName("");
                router.refresh();
              }
            });
          }}
        >
          <input
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            placeholder="New tag name..."
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted dark:placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={isPending || !newTagName.trim()}
            className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
          >
            + New Tag
          </button>
        </form>
      </div>{" "}
      {error && <p className="text-sm text-red-600">{error}</p>}{" "}
      <div className="rounded-xl border border-light bg-surface p-4 shadow-sm">
        {" "}
        <table className="w-full text-left text-sm">
          {" "}
          <thead>
            {" "}
            <tr className="border-b text-muted">
              {" "}
              <th className="pb-2">Tag</th> <th className="pb-2">Resources</th>{" "}
              <th className="pb-2">Actions</th>{" "}
            </tr>{" "}
          </thead>{" "}
          <tbody>
            {" "}
            {filtered.map((tag) => (
              <tr key={tag.id} className="border-b last:border-0">
                {" "}
                <td className="py-2">
                  {" "}
                  <div className="font-medium">{tag.name}</div>{" "}
                </td>{" "}
                <td className="py-2">{tag.resource_count}</td>{" "}
                <td className="py-2">
                  {" "}
                  <div className="flex flex-wrap items-center gap-2">
                    {" "}
                    <input
                      value={renameValue[tag.id] ?? tag.name}
                      onChange={(e) =>
                        setRenameValue((prev) => ({
                          ...prev,
                          [tag.id]: e.target.value,
                        }))
                      }
                      className="rounded border px-2 py-1 text-xs"
                    />{" "}
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          const res = await renameTag(
                            tag.id,
                            renameValue[tag.id] ?? tag.name,
                          );
                          if ("error" in res)
                            setError(res.error || "Failed to rename");
                          else router.refresh();
                        })
                      }
                      aria-label={`Rename tag ${tag.name}`}
                      className="rounded border px-2 py-1 text-xs"
                      disabled={isPending}
                    >
                      {" "}
                      Rename{" "}
                    </button>{" "}
                    <select
                      value={mergeTarget[tag.id] || ""}
                      onChange={(e) =>
                        setMergeTarget((prev) => ({
                          ...prev,
                          [tag.id]: e.target.value,
                        }))
                      }
                      className="rounded border px-2 py-1 text-xs"
                    >
                      {" "}
                      <option value="">Merge into...</option>{" "}
                      {tags
                        .filter((candidate) => candidate.id !== tag.id)
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            {" "}
                            {candidate.name}{" "}
                          </option>
                        ))}{" "}
                    </select>{" "}
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          const targetId = mergeTarget[tag.id];
                          if (!targetId) return;
                          const res = await mergeTags(tag.id, targetId);
                          if ("error" in res)
                            setError(res.error || "Failed to merge");
                          else router.refresh();
                        })
                      }
                      aria-label={`Merge tag ${tag.name}`}
                      className="rounded border px-2 py-1 text-xs"
                      disabled={isPending || !mergeTarget[tag.id]}
                    >
                      {" "}
                      Merge{" "}
                    </button>{" "}
                    <button
                      onClick={() =>
                        startTransition(async () => {
                          if (!confirm(`Delete tag '${tag.name}'?`)) return;
                          const res = await deleteTag(tag.id);
                          if ("error" in res)
                            setError(res.error || "Failed to delete");
                          else router.refresh();
                        })
                      }
                      aria-label={`Delete tag ${tag.name}`}
                      className="rounded border border-[var(--error-border)] px-2 py-1 text-xs text-red-600"
                      disabled={isPending}
                    >
                      {" "}
                      Delete{" "}
                    </button>{" "}
                  </div>{" "}
                </td>{" "}
              </tr>
            ))}{" "}
          </tbody>{" "}
        </table>{" "}
      </div>{" "}
    </div>
  );
}
