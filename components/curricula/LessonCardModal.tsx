"use client";

import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import {
  updateLessonCard,
  deleteLessonCard,
  reorderLessonCards,
} from "@/lib/actions/lesson-cards";
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  ArrowUp,
  ArrowDown,
  ExternalLink,
} from "lucide-react";

type LessonCardData = {
  id: string;
  lesson_id: string;
  card_type: string;
  title: string | null;
  content: string | null;
  url: string | null;
  thumbnail_url: string | null;
  og_title: string | null;
  og_description: string | null;
  og_image: string | null;
  resource_id: string | null;
  resource_title: string | null;
  resource_url: string | null;
  resource_thumbnail_url: string | null;
  order_index: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  card: LessonCardData;
  allCards: LessonCardData[];
  onNavigate: (cardId: string) => void;
};

const typeVariantMap: Record<string, "default" | "success" | "warning" | "danger" | "info"> = {
  youtube: "danger",
  checklist: "info",
  url: "default",
  image: "success",
  note: "default",
  resource: "default",
};

function extractYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export default function LessonCardModal({
  open,
  onClose,
  card,
  allCards,
  onNavigate,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(card.title || "");
  const [editContent, setEditContent] = useState(card.content || "");
  const [editUrl, setEditUrl] = useState(card.url || "");
  const [editType, setEditType] = useState(card.card_type);

  // Reset form state when card changes
  useEffect(() => {
    setEditTitle(card.title || "");
    setEditContent(card.content || "");
    setEditUrl(card.url || "");
    setEditType(card.card_type);
    setEditing(false);
  }, [card.id, card.title, card.content, card.url, card.card_type]);

  const currentIndex = allCards.findIndex((c) => c.id === card.id);
  const prevCard = currentIndex > 0 ? allCards[currentIndex - 1] : null;
  const nextCard =
    currentIndex < allCards.length - 1 ? allCards[currentIndex + 1] : null;

  async function toggleCheckItem(lineIndex: number) {
    const lines = (card.content || "").split("\n");
    const line = lines[lineIndex];
    if (/^- \[x\]/i.test(line)) {
      lines[lineIndex] = line.replace(/^- \[x\]/i, "- [ ]");
    } else if (/^- \[ \]/.test(line)) {
      lines[lineIndex] = line.replace("- [ ]", "- [x]");
    }
    const fd = new FormData();
    fd.set("id", card.id);
    fd.set("content", lines.join("\n"));
    startTransition(async () => {
      await updateLessonCard(fd);
      router.refresh();
    });
  }

  function handleSave() {
    const fd = new FormData();
    fd.set("id", card.id);
    fd.set("card_type", editType);
    fd.set("title", editTitle);
    if (editType === "note" || editType === "checklist") {
      fd.set("content", editContent);
    }
    if (
      editType === "url" ||
      editType === "youtube" ||
      editType === "image"
    ) {
      fd.set("url", editUrl);
    }
    startTransition(async () => {
      await updateLessonCard(fd);
      router.refresh();
      setEditing(false);
    });
  }

  function handleCancel() {
    setEditTitle(card.title || "");
    setEditContent(card.content || "");
    setEditUrl(card.url || "");
    setEditType(card.card_type);
    setEditing(false);
  }

  function handleDelete() {
    if (!window.confirm("Delete this card?")) return;
    startTransition(async () => {
      await deleteLessonCard(card.id);
      router.refresh();
      onClose();
    });
  }

  function handleMoveUp() {
    if (currentIndex <= 0) return;
    const prev = allCards[currentIndex - 1];
    startTransition(async () => {
      await reorderLessonCards([
        { id: card.id, order_index: prev.order_index },
        { id: prev.id, order_index: card.order_index },
      ]);
      router.refresh();
    });
  }

  function handleMoveDown() {
    if (currentIndex >= allCards.length - 1) return;
    const next = allCards[currentIndex + 1];
    startTransition(async () => {
      await reorderLessonCards([
        { id: card.id, order_index: next.order_index },
        { id: next.id, order_index: card.order_index },
      ]);
      router.refresh();
    });
  }

  // ── Content renderers ──────────────────────────────────────────────

  function renderYouTube() {
    if (!card.url) return null;
    const ytId = extractYouTubeId(card.url);
    if (!ytId) return <p className="text-muted text-sm">Invalid YouTube URL</p>;
    return (
      <iframe
        src={`https://www.youtube-nocookie.com/embed/${ytId}`}
        className="aspect-video w-full rounded-lg"
        allowFullScreen
        title={card.title || "YouTube video"}
      />
    );
  }

  function renderImage() {
    if (!card.url) return null;
    return (
      <img
        src={card.url}
        alt={card.title || ""}
        className="w-full rounded-lg object-contain"
      />
    );
  }

  function renderUrl() {
    if (!card.url) return null;
    const domain = extractDomain(card.url);
    const hasOg = card.og_title || card.og_description || card.og_image;

    if (hasOg) {
      return (
        <div className="space-y-3">
          {card.og_image && (
            <img
              src={card.og_image}
              alt={card.og_title || ""}
              className="w-full rounded-lg"
            />
          )}
          <p className="font-medium text-primary">
            {card.og_title || card.title || "Untitled"}
          </p>
          {card.og_description && (
            <p className="text-sm text-secondary line-clamp-3">
              {card.og_description}
            </p>
          )}
          <p className="text-xs text-muted">{domain}</p>
          <a
            href={card.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
          >
            <ExternalLink size={14} />
            Open link
          </a>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
          alt=""
          className="h-8 w-8"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-primary">{domain}</p>
          <p className="truncate text-xs text-muted">{card.url}</p>
        </div>
        <a
          href={card.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover"
        >
          <ExternalLink size={14} />
          Open link
        </a>
      </div>
    );
  }

  function renderChecklist() {
    const lines = (card.content || "").split("\n");
    const checkItems = lines
      .map((line, i) => ({ line, index: i }))
      .filter(({ line }) => /^- \[[ x]\]/i.test(line));
    const completed = checkItems.filter(({ line }) =>
      /^- \[x\]/i.test(line)
    ).length;

    return (
      <div className="space-y-3">
        {card.title && (
          <p className="font-medium text-primary">{card.title}</p>
        )}
        <p className="text-xs text-muted">
          {completed}/{checkItems.length} completed
        </p>
        <ul className="space-y-1.5">
          {checkItems.map(({ line, index }) => {
            const isChecked = /^- \[x\]/i.test(line);
            const label = line.replace(/^- \[[ x]\]\s*/i, "");
            return (
              <li key={index} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  checked={isChecked}
                  disabled={isPending}
                  onChange={() => toggleCheckItem(index)}
                  className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--interactive)]"
                />
                <span
                  className={`text-sm ${
                    isChecked
                      ? "text-muted line-through"
                      : "text-primary"
                  }`}
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  function renderNote() {
    return (
      <div className="space-y-2">
        {card.title && (
          <p className="font-medium text-primary">{card.title}</p>
        )}
        {card.content && (
          <p className="whitespace-pre-wrap text-sm text-secondary">
            {card.content}
          </p>
        )}
      </div>
    );
  }

  function renderResource() {
    return (
      <div className="space-y-3">
        {card.resource_thumbnail_url && (
          <img
            src={card.resource_thumbnail_url}
            alt={card.resource_title || ""}
            className="w-full rounded-lg object-contain"
          />
        )}
        {card.resource_title && (
          <p className="font-medium text-primary">{card.resource_title}</p>
        )}
        {card.resource_url && (
          <a
            href={card.resource_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-interactive hover:underline"
          >
            <ExternalLink size={14} />
            Open resource
          </a>
        )}
      </div>
    );
  }

  function renderContent() {
    switch (card.card_type) {
      case "youtube":
        return renderYouTube();
      case "image":
        return renderImage();
      case "url":
        return renderUrl();
      case "checklist":
        return renderChecklist();
      case "note":
        return renderNote();
      case "resource":
        return renderResource();
      default:
        return renderNote();
    }
  }

  // ── Edit form ──────────────────────────────────────────────────────

  function renderEditForm() {
    const showUrl =
      editType === "url" || editType === "youtube" || editType === "image";
    const showContent = editType === "note" || editType === "checklist";

    return (
      <div className="space-y-4">
        {/* Title */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Title
          </label>
          <input
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          />
        </div>

        {/* Card type */}
        <div>
          <label className="mb-1 block text-sm font-medium text-secondary">
            Card type
          </label>
          <select
            value={editType}
            onChange={(e) => setEditType(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
          >
            <option value="note">Note</option>
            <option value="url">URL</option>
            <option value="youtube">YouTube</option>
            <option value="checklist">Checklist</option>
            <option value="image">Image</option>
            <option value="resource">Resource</option>
          </select>
        </div>

        {/* URL */}
        {showUrl && (
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              URL
            </label>
            <input
              type="text"
              value={editUrl}
              onChange={(e) => setEditUrl(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
        )}

        {/* Content */}
        {showContent && (
          <div>
            <label className="mb-1 block text-sm font-medium text-secondary">
              Content
            </label>
            <textarea
              rows={4}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-focus"
            />
          </div>
        )}

        {/* Move up/down */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleMoveUp}
            disabled={isPending || currentIndex <= 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-secondary hover:bg-muted/30 disabled:opacity-50"
          >
            <ArrowUp size={14} />
            Move up
          </button>
          <button
            type="button"
            onClick={handleMoveDown}
            disabled={isPending || currentIndex >= allCards.length - 1}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-secondary hover:bg-muted/30 disabled:opacity-50"
          >
            <ArrowDown size={14} />
            Move down
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-between border-t border-light pt-4">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            <Trash2 size={14} />
            Delete
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-secondary hover:bg-muted/30 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending}
              className="rounded-lg bg-interactive px-4 py-2 text-sm font-medium text-white hover:bg-interactive-hover disabled:opacity-50"
            >
              {isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ────────────────────────────────────────────────────

  return (
    <Modal open={open} onClose={onClose} className="max-w-2xl">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={typeVariantMap[card.card_type] || "default"}>
              {card.card_type}
            </Badge>
            <h3 className="font-display text-lg text-primary">
              {card.title || "Untitled"}
            </h3>
          </div>
          {!editing && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-2 text-sm text-secondary hover:bg-muted/30"
            >
              <Pencil size={14} />
              Edit
            </button>
          )}
        </div>

        {/* Content or edit form */}
        {editing ? renderEditForm() : renderContent()}

        {/* Footer: navigation */}
        {!editing && (
          <div className="flex items-center justify-between border-t border-light pt-4">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => prevCard && onNavigate(prevCard.id)}
                disabled={!prevCard || isPending}
                className="rounded-lg border border-border bg-surface p-2 text-secondary hover:bg-muted/30 disabled:opacity-50"
                aria-label="Previous card"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-muted">
                Card {currentIndex + 1} of {allCards.length}
              </span>
              <button
                type="button"
                onClick={() => nextCard && onNavigate(nextCard.id)}
                disabled={!nextCard || isPending}
                className="rounded-lg border border-border bg-surface p-2 text-secondary hover:bg-muted/30 disabled:opacity-50"
                aria-label="Next card"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
