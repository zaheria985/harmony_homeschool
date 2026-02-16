"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
type TagItem = { name: string; resource_count: number };
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
export default function TagsClient({ tags }: { tags: TagItem[] }) {
  const [search, setSearch] = useState("");
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
      {" "}
      <div className="mb-4">
        {" "}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter tags..."
          className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted"
        />{" "}
      </div>{" "}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted">No tags found.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {" "}
          {filtered.map((tag) => (
            <Link
              key={tag.name}
              href={`/resources?tag=${encodeURIComponent(tag.name)}`}
              className="flex items-center justify-between rounded-lg border border-light bg-surface p-3 shadow-sm hover:border-interactive-border"
            >
              {" "}
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${styleForTag(tag.name)}`}
              >
                {" "}
                {tag.name}{" "}
              </span>{" "}
              <span className="text-xs text-muted">
                {" "}
                {tag.resource_count}{" "}
                {tag.resource_count === 1 ? "resource" : "resources"}{" "}
              </span>{" "}
            </Link>
          ))}{" "}
        </div>
      )}{" "}
    </div>
  );
}
