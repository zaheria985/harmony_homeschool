"use client";
import { useMemo, useState } from "react";
function parseTags(value: string): string[] {
  return Array.from(
    new Set(
      value
        .split(",")
        .map((part) => part.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}
export default function TagInput({
  value,
  onChange,
  allTags,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  allTags: string[];
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => parseTags(value), [value]);
  const normalizedTags = useMemo(
    () =>
      Array.from(
        new Set(allTags.map((tag) => tag.toLowerCase().trim())),
      ).filter(Boolean),
    [allTags],
  );
  const matches = useMemo(() => {
    if (!query.trim()) return normalizedTags;
    const q = query.trim().toLowerCase();
    return normalizedTags.filter((tag) => tag.includes(q));
  }, [query, normalizedTags]);
  function commitTag(raw: string) {
    const tag = raw.trim().toLowerCase();
    if (!tag) return;
    const next = Array.from(new Set([...selected, tag]));
    onChange(next.join(","));
    setQuery("");
    setOpen(true);
  }
  function removeTag(tag: string) {
    const next = selected.filter((item) => item !== tag);
    onChange(next.join(","));
  }
  return (
    <div className="space-y-2">
      {" "}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {" "}
          {selected.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => removeTag(tag)}
              className="inline-flex items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-0.5 text-xs text-secondary hover:bg-surface-subtle"
              title={`Remove ${tag}`}
            >
              {" "}
              <span>{tag}</span> <span aria-hidden="true">×</span>{" "}
            </button>
          ))}{" "}
        </div>
      )}{" "}
      <div className="relative">
        {" "}
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setTimeout(() => setOpen(false), 100);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === ",") {
              event.preventDefault();
              commitTag(query);
            }
          }}
          placeholder={placeholder || "Type tag and press Enter"}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary placeholder:text-muted focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-focus placeholder:text-muted"
        />{" "}
        {open && (
          <div className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-light bg-surface p-1 shadow-lg">
            {" "}
            {query.trim() && !selected.includes(query.trim().toLowerCase()) && (
              <button
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => commitTag(query)}
                className="block w-full rounded px-2 py-1.5 text-left text-sm text-interactive hover:bg-interactive-light"
              >
                {" "}
                Add &quot;{query.trim()}&quot;{" "}
              </button>
            )}{" "}
            {matches.length === 0 ? (
              <p className="px-2 py-1.5 text-xs text-muted">
                No matching tags
              </p>
            ) : (
              matches.map((tag) => {
                const selectedTag = selected.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => commitTag(tag)}
                    disabled={selectedTag}
                    className={`block w-full rounded px-2 py-1.5 text-left text-sm ${selectedTag ? "cursor-not-allowed text-muted" : "text-secondary hover:bg-surface-muted"}`}
                  >
                    {" "}
                    {tag}{" "}
                  </button>
                );
              })
            )}{" "}
          </div>
        )}{" "}
      </div>{" "}
      <p className="text-xs text-muted">
        Type to search tags, press Enter to add
      </p>{" "}
    </div>
  );
}
