"use client";

import { useState } from "react";

interface BookRecommendation {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
  tag_matches: number;
  tags: string[];
}

export default function BookRecommendations({
  recommendations,
}: {
  recommendations: BookRecommendation[];
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (recommendations.length === 0) return null;

  return (
    <div className="mb-6 rounded-xl border border-light bg-surface p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-primary">
          Suggested Books
        </h3>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-xs text-muted hover:text-interactive"
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Books not yet on any list, matched by curriculum tags
      </p>

      {!collapsed && (
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {recommendations.map((book) => (
            <div
              key={book.id}
              className="group flex flex-col rounded-lg border border-light bg-surface-muted p-2 transition-colors hover:border-interactive"
            >
              {book.thumbnail_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={book.thumbnail_url}
                  alt={book.title}
                  className="mb-2 h-24 w-full rounded object-cover"
                />
              ) : (
                <div className="mb-2 flex h-24 w-full items-center justify-center rounded bg-surface-subtle text-2xl text-muted">
                  &#128218;
                </div>
              )}
              <p className="line-clamp-2 text-xs font-medium text-primary">
                {book.title}
              </p>
              {book.author && (
                <p className="mt-0.5 line-clamp-1 text-[10px] text-muted">
                  {book.author}
                </p>
              )}
              {book.tag_matches > 0 && (
                <div className="mt-auto pt-1">
                  <span className="inline-block rounded-full bg-interactive/10 px-1.5 py-0.5 text-[10px] font-medium text-interactive">
                    {book.tag_matches} tag match{book.tag_matches !== 1 ? "es" : ""}
                  </span>
                </div>
              )}
              {book.tags.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {book.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded bg-surface-subtle px-1 py-0.5 text-[9px] text-muted"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
