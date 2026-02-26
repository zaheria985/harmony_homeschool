"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { linkBooklistToCurriculum, unlinkBooklistFromCurriculum } from "@/lib/actions/booklists";

type LinkedBooklist = {
  id: string;
  name: string;
  description: string | null;
  book_count: number;
};

type BooklistSummary = {
  id: string;
  name: string;
  book_count: number;
};

export default function LinkedBooklists({
  curriculumId,
  linkedBooklists,
  allBooklists,
  isParent,
}: {
  curriculumId: string;
  linkedBooklists: LinkedBooklist[];
  allBooklists: BooklistSummary[];
  isParent: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);

  const linkedIds = new Set(linkedBooklists.map((b) => b.id));
  const available = allBooklists.filter((b) => !linkedIds.has(b.id));

  function handleLink(booklistId: string) {
    startTransition(async () => {
      await linkBooklistToCurriculum(curriculumId, booklistId);
      setShowAdd(false);
      router.refresh();
    });
  }

  function handleUnlink(booklistId: string) {
    startTransition(async () => {
      await unlinkBooklistFromCurriculum(curriculumId, booklistId);
      router.refresh();
    });
  }

  if (linkedBooklists.length === 0 && !isParent) return null;

  return (
    <div className="mb-6">
      {(linkedBooklists.length > 0 || isParent) && (
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">
            Reading Lists
          </h3>
          {isParent && (
            <button
              onClick={() => setShowAdd(!showAdd)}
              className="text-xs text-interactive hover:underline"
              disabled={isPending}
            >
              {showAdd ? "Cancel" : "+ Link Booklist"}
            </button>
          )}
        </div>
      )}

      {showAdd && available.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {available.map((bl) => (
            <button
              key={bl.id}
              onClick={() => handleLink(bl.id)}
              disabled={isPending}
              className="rounded-lg border border-dashed border-light px-3 py-1.5 text-xs text-secondary hover:border-interactive hover:text-interactive disabled:opacity-50"
            >
              {bl.name} ({bl.book_count})
            </button>
          ))}
        </div>
      )}
      {showAdd && available.length === 0 && (
        <p className="mb-3 text-xs text-muted">
          All booklists are already linked.{" "}
          <Link href="/booklists" className="text-interactive hover:underline">
            Create a new booklist
          </Link>
        </p>
      )}

      {linkedBooklists.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {linkedBooklists.map((bl) => (
            <div
              key={bl.id}
              className="group flex items-center gap-1.5 rounded-lg border border-light bg-surface px-3 py-1.5"
            >
              <Link
                href="/booklists"
                className="text-sm text-secondary hover:text-interactive"
              >
                {bl.name}
              </Link>
              <span className="text-xs text-muted">
                ({bl.book_count} {bl.book_count === 1 ? "book" : "books"})
              </span>
              {isParent && (
                <button
                  onClick={() => handleUnlink(bl.id)}
                  disabled={isPending}
                  className="ml-1 hidden text-xs text-muted hover:text-red-500 group-hover:inline disabled:opacity-50"
                  title="Unlink booklist"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
