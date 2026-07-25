"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  FileText,
  ListChecks,
  Link2,
  Image as ImageIcon,
  BookOpen,
  Package,
  ArrowLeft,
  Search,
} from "lucide-react";
import { createLessonCard, createPhotoCard } from "@/lib/actions/lesson-cards";
import {
  attachBookToLesson,
  bulkAddSuppliesToLesson,
  searchBooksForPicker,
} from "@/lib/actions/resources";

/**
 * The one way to put something on a lesson.
 *
 * The two groups are the user's own distinction, and the picker keeps it
 * visible rather than flattening it: **lesson cards** are how you run the
 * lesson (instructions, checklists, links, photos) and live on the board;
 * **materials** are the physical things you have to gather, and feed the
 * planner's "materials this week" panel. A book is deliberately both.
 */

type Mode =
  | "menu"
  | "text"
  | "checklist"
  | "link"
  | "photo"
  | "book"
  | "supply";

type BookResult = {
  id: string;
  title: string;
  author: string | null;
  thumbnail_url: string | null;
};

export default function AddToLessonPicker({
  lessonId,
  onDone,
  align = "left",
}: {
  lessonId: string;
  /** Called after something is added, so the caller can close a popover. */
  onDone?: () => void;
  align?: "left" | "right";
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("menu");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function finish() {
    setMode("menu");
    setError("");
    router.refresh();
    onDone?.();
  }

  function run(work: () => Promise<ActionResult>) {
    setError("");
    startTransition(async () => {
      const result = await work();
      const failure =
        result && typeof result === "object" && "error" in result
          ? (result as { error?: string }).error
          : undefined;
      if (failure) {
        setError(failure);
        return;
      }
      finish();
    });
  }

  return (
    <div
      className={`w-72 rounded-xl border border-light bg-surface p-2 shadow-warm-lg ${align === "right" ? "origin-top-right" : "origin-top-left"}`}
      onClick={(event) => event.stopPropagation()}
    >
      {mode === "menu" ? (
        <Menu onPick={setMode} />
      ) : (
        <>
          <button
            type="button"
            onClick={() => {
              setMode("menu");
              setError("");
            }}
            className="mb-1 flex items-center gap-1 px-1 text-xs text-muted hover:text-primary"
          >
            <ArrowLeft size={12} />
            Back
          </button>
          {mode === "text" && (
            <TextForm lessonId={lessonId} busy={isPending} onSubmit={run} />
          )}
          {mode === "checklist" && (
            <ChecklistForm lessonId={lessonId} busy={isPending} onSubmit={run} />
          )}
          {mode === "link" && (
            <LinkForm lessonId={lessonId} busy={isPending} onSubmit={run} />
          )}
          {mode === "photo" && (
            <PhotoForm lessonId={lessonId} busy={isPending} onSubmit={run} />
          )}
          {mode === "book" && (
            <BookForm lessonId={lessonId} busy={isPending} onSubmit={run} />
          )}
          {mode === "supply" && (
            <SupplyForm lessonId={lessonId} busy={isPending} onSubmit={run} />
          )}
        </>
      )}
      {error && (
        <p role="alert" className="px-1 pt-2 text-xs font-medium text-[var(--error-text)]">
          {error}
        </p>
      )}
    </div>
  );
}

function Menu({ onPick }: { onPick: (mode: Mode) => void }) {
  return (
    <div className="flex flex-col gap-0.5">
      <GroupLabel>Lesson cards</GroupLabel>
      <Choice icon={<FileText size={15} />} onClick={() => onPick("text")}>
        Text
        <Hint>notes, questions, a passage</Hint>
      </Choice>
      <Choice icon={<ListChecks size={15} />} onClick={() => onPick("checklist")}>
        Checklist
        <Hint>steps to tick off</Hint>
      </Choice>
      <Choice icon={<Link2 size={15} />} onClick={() => onPick("link")}>
        Link or video
      </Choice>
      <Choice icon={<ImageIcon size={15} />} onClick={() => onPick("photo")}>
        Photo
        <Hint>upload from this device</Hint>
      </Choice>

      <GroupLabel>Materials needed</GroupLabel>
      <Choice icon={<BookOpen size={15} />} onClick={() => onPick("book")}>
        Book
        <Hint>from your library</Hint>
      </Choice>
      <Choice icon={<Package size={15} />} onClick={() => onPick("supply")}>
        Supplies
      </Choice>
    </div>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="px-2 pb-0.5 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted first:pt-0">
      {children}
    </p>
  );
}

function Choice({
  icon,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[38px] w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-primary transition-colors hover:bg-surface-muted"
    >
      <span className="text-interactive">{icon}</span>
      <span className="min-w-0">{children}</span>
    </button>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <span className="block text-[11px] text-muted">{children}</span>;
}

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-2 py-1.5 text-sm text-primary placeholder:text-muted focus:border-interactive focus:outline-none focus:ring-1 focus:ring-focus";

function SaveButton({ busy, label }: { busy: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={busy}
      className="min-h-[36px] w-full rounded-lg bg-[var(--interactive)] px-3 text-sm font-medium text-[var(--brand-contrast)] transition-colors hover:bg-[var(--interactive-hover)] disabled:opacity-60"
    >
      {busy ? "Adding…" : label}
    </button>
  );
}

/** Whatever an add action returns; only an `error` field is acted on. */
type ActionResult = { error?: string } | Record<string, unknown> | void;

type SubmitRunner = (work: () => Promise<ActionResult>) => void;

function TextForm({
  lessonId,
  busy,
  onSubmit,
}: {
  lessonId: string;
  busy: boolean;
  onSubmit: SubmitRunner;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  return (
    <form
      className="flex flex-col gap-2 p-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (!title.trim()) return;
        onSubmit(async () => {
          const fd = new FormData();
          fd.set("lesson_id", lessonId);
          fd.set("card_type", "note");
          fd.set("title", title.trim());
          if (body.trim()) fd.set("content", body.trim());
          return createLessonCard(fd);
        });
      }}
    >
      <input
        autoFocus
        className={fieldClass}
        placeholder="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className={`${fieldClass} min-h-[90px]`}
        placeholder="Text — markdown works"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <SaveButton busy={busy} label="Add text card" />
    </form>
  );
}

function ChecklistForm({
  lessonId,
  busy,
  onSubmit,
}: {
  lessonId: string;
  busy: boolean;
  onSubmit: SubmitRunner;
}) {
  const [title, setTitle] = useState("");
  const [items, setItems] = useState("");

  return (
    <form
      className="flex flex-col gap-2 p-1"
      onSubmit={(event) => {
        event.preventDefault();
        const lines = items
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (!title.trim() || lines.length === 0) return;
        onSubmit(async () => {
          const fd = new FormData();
          fd.set("lesson_id", lessonId);
          fd.set("card_type", "checklist");
          fd.set("title", title.trim());
          // Markdown task list — the tick state lives in the text itself.
          fd.set("content", lines.map((line) => `- [ ] ${line}`).join("\n"));
          return createLessonCard(fd);
        });
      }}
    >
      <input
        autoFocus
        className={fieldClass}
        placeholder="Title"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <textarea
        className={`${fieldClass} min-h-[90px]`}
        placeholder={"One step per line"}
        value={items}
        onChange={(event) => setItems(event.target.value)}
      />
      <SaveButton busy={busy} label="Add checklist" />
    </form>
  );
}

function LinkForm({
  lessonId,
  busy,
  onSubmit,
}: {
  lessonId: string;
  busy: boolean;
  onSubmit: SubmitRunner;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  return (
    <form
      className="flex flex-col gap-2 p-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (!url.trim()) return;
        onSubmit(async () => {
          const fd = new FormData();
          fd.set("lesson_id", lessonId);
          fd.set("url", url.trim());
          if (title.trim()) fd.set("title", title.trim());
          return createLessonCard(fd);
        });
      }}
    >
      <input
        autoFocus
        className={fieldClass}
        placeholder="https://…"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />
      <input
        className={fieldClass}
        placeholder="Title (optional)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <p className="px-1 text-[11px] text-muted">
        YouTube links pick up their own title and thumbnail.
      </p>
      <SaveButton busy={busy} label="Add link" />
    </form>
  );
}

function PhotoForm({
  lessonId,
  busy,
  onSubmit,
}: {
  lessonId: string;
  busy: boolean;
  onSubmit: SubmitRunner;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState("");

  return (
    <form
      className="flex flex-col gap-2 p-1"
      onSubmit={(event) => {
        event.preventDefault();
        const file = fileRef.current?.files?.[0];
        if (!file) return;
        onSubmit(async () => {
          const fd = new FormData();
          fd.set("lesson_id", lessonId);
          fd.set("photo", file);
          if (title.trim()) fd.set("title", title.trim());
          return createPhotoCard(fd);
        });
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="w-full text-xs text-tertiary file:mr-2 file:rounded-lg file:border-0 file:bg-surface-muted file:px-2 file:py-1.5 file:text-xs file:text-primary"
      />
      <input
        className={fieldClass}
        placeholder="Caption (optional)"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <SaveButton busy={busy} label="Add photo" />
    </form>
  );
}

function BookForm({
  lessonId,
  busy,
  onSubmit,
}: {
  lessonId: string;
  busy: boolean;
  onSubmit: SubmitRunner;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [pageRef, setPageRef] = useState("");
  const [author, setAuthor] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let live = true;
    setSearching(true);
    // Let typing settle before asking the server.
    const timer = setTimeout(async () => {
      const response = await searchBooksForPicker(term);
      if (!live) return;
      setSearching(false);
      if ("results" in response) setResults(response.results ?? []);
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [query]);

  function attachExisting(resourceId: string) {
    onSubmit(async () =>
      attachBookToLesson({
        lessonId,
        resourceId,
        pageRef: pageRef.trim() || undefined,
      }),
    );
  }

  return (
    <div className="flex flex-col gap-2 p-1">
      <div className="relative">
        <Search
          size={13}
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          autoFocus
          className={`${fieldClass} pl-7`}
          placeholder="Search your books"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setCreating(false);
          }}
        />
      </div>
      <input
        className={fieldClass}
        placeholder="Pages (optional) — e.g. 38–39"
        value={pageRef}
        onChange={(event) => setPageRef(event.target.value)}
      />

      {query.trim().length >= 2 && (
        <div className="max-h-44 overflow-y-auto">
          {searching && <p className="px-1 py-2 text-xs text-muted">Searching…</p>}
          {!searching && results.length === 0 && !creating && (
            <div className="px-1 py-2">
              <p className="text-xs text-muted">No book by that name yet.</p>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="mt-1 text-xs font-medium text-interactive hover:underline"
              >
                Add “{query.trim()}” as a new book
              </button>
            </div>
          )}
          {!searching &&
            results.map((book) => (
              <button
                key={book.id}
                type="button"
                disabled={busy}
                onClick={() => attachExisting(book.id)}
                className="flex w-full items-center gap-2 rounded-lg p-1 text-left transition-colors hover:bg-surface-muted disabled:opacity-60"
              >
                {book.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={book.thumbnail_url}
                    alt=""
                    className="h-10 w-7 flex-shrink-0 rounded object-cover"
                  />
                ) : (
                  <span className="flex h-10 w-7 flex-shrink-0 items-center justify-center rounded bg-surface-muted text-[10px] text-muted">
                    <BookOpen size={12} />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-xs text-primary">
                    {book.title}
                  </span>
                  {book.author && (
                    <span className="block truncate text-[11px] text-muted">
                      {book.author}
                    </span>
                  )}
                </span>
              </button>
            ))}
        </div>
      )}

      {creating && (
        <form
          className="flex flex-col gap-2 border-t border-light pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit(async () =>
              attachBookToLesson({
                lessonId,
                title: query.trim(),
                author: author.trim() || undefined,
                pageRef: pageRef.trim() || undefined,
              }),
            );
          }}
        >
          <input
            autoFocus
            className={fieldClass}
            placeholder="Author (helps find the cover)"
            value={author}
            onChange={(event) => setAuthor(event.target.value)}
          />
          <SaveButton busy={busy} label="Create and attach" />
        </form>
      )}
    </div>
  );
}

function SupplyForm({
  lessonId,
  busy,
  onSubmit,
}: {
  lessonId: string;
  busy: boolean;
  onSubmit: SubmitRunner;
}) {
  const [lines, setLines] = useState("");

  return (
    <form
      className="flex flex-col gap-2 p-1"
      onSubmit={(event) => {
        event.preventDefault();
        if (!lines.trim()) return;
        onSubmit(async () => bulkAddSuppliesToLesson(lessonId, lines));
      }}
    >
      <textarea
        autoFocus
        className={`${fieldClass} min-h-[90px]`}
        placeholder={"One supply per line"}
        value={lines}
        onChange={(event) => setLines(event.target.value)}
      />
      <p className="px-1 text-[11px] text-muted">
        Supplies show up in the planner&apos;s materials list for that week.
      </p>
      <SaveButton busy={busy} label="Add supplies" />
    </form>
  );
}
