"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type SearchResult = {
  type: "lesson" | "curriculum" | "subject" | "resource" | "booklist";
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
};

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  lesson: "Lesson",
  curriculum: "Course",
  subject: "Subject",
  resource: "Resource",
  booklist: "Booklist",
};

export default function SearchCommand() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Cmd/Ctrl-K toggles the palette from anywhere.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((previous) => !previous);
      }
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults([]);
      setActiveIndex(0);
      // Focus after the dialog has painted.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  // Debounced fetch. The abort controller keeps a slow earlier request from
  // overwriting the results of a later one.
  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/search?q=${encodeURIComponent(query)}`,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("search failed");
        const data = await response.json();
        setResults(data.results ?? []);
        setActiveIndex(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  const go = useCallback(
    (result: SearchResult) => {
      setOpen(false);
      router.push(result.href);
    },
    [router],
  );

  function onInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = results[activeIndex];
      if (result) go(result);
    }
  }

  // Keep the highlighted row visible when arrowing through a long list.
  useEffect(() => {
    const active = listRef.current?.children[activeIndex] as
      | HTMLElement
      | undefined;
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="flex w-full items-center gap-2 rounded-lg border border-light bg-surface px-3 py-2 text-left text-sm text-muted hover:border-interactive-border hover:text-interactive"
      >
        <span aria-hidden="true">&#128269;</span>
        <span className="flex-1">Search…</span>
        <kbd className="hidden rounded border border-light px-1 text-[10px] text-muted sm:inline">
          &#8984;K
        </kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[10vh]"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Search"
            className="w-full max-w-lg overflow-hidden rounded-2xl border border-light bg-surface shadow-warm-md"
            onClick={(event) => event.stopPropagation()}
          >
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onInputKeyDown}
              placeholder="Search lessons, courses, resources…"
              aria-label="Search query"
              aria-controls="search-results"
              className="w-full border-b border-light bg-surface px-4 py-3 text-sm text-primary outline-none"
            />

            <ul
              ref={listRef}
              id="search-results"
              role="listbox"
              className="max-h-80 overflow-y-auto"
            >
              {results.map((result, index) => (
                <li key={`${result.type}-${result.id}`} role="none">
                  <button
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(result)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${
                      index === activeIndex ? "bg-interactive-light" : ""
                    }`}
                  >
                    <span className="w-16 shrink-0 text-[10px] uppercase tracking-wide text-muted">
                      {TYPE_LABELS[result.type]}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-primary">
                        {result.title}
                      </span>
                      {result.subtitle && (
                        <span className="block truncate text-xs text-muted">
                          {result.subtitle}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            <p className="border-t border-light px-4 py-2 text-xs text-muted">
              {loading
                ? "Searching…"
                : query.trim().length < 2
                  ? "Type at least 2 characters."
                  : results.length === 0
                    ? "No matches."
                    : "↑↓ to navigate, Enter to open, Esc to close."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
