"use client";
import Modal from "@/components/ui/Modal";
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
export default function ResourcePreviewModal({
  open,
  onClose,
  title,
  type,
  url,
  thumbnailUrl,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  type: string;
  url: string | null;
  thumbnailUrl?: string | null;
}) {
  const youtubeId =
    (type === "youtube" || type === "video") && url
      ? extractYouTubeId(url)
      : null;
  return (
    <Modal open={open} onClose={onClose} title={title || "Resource Preview"}>
      {" "}
      <div className="space-y-3">
        {" "}
        {youtubeId ? (
          <div className="overflow-hidden rounded-lg border border-light">
            {" "}
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${youtubeId}`}
              className="aspect-video w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              title={title || "YouTube video"}
            />{" "}
          </div>
        ) : thumbnailUrl ? (
          <div className="rounded-lg border border-light p-2">
            {" "}
            {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
            <img
              src={thumbnailUrl}
              alt={title}
              className="h-auto max-h-[50vh] w-full rounded bg-transparent object-contain"
            />{" "}
          </div>
        ) : (
          <div className="rounded-lg border border-light bg-surface-muted p-4 text-sm text-tertiary">
            {" "}
            This resource does not have an inline preview.{" "}
          </div>
        )}{" "}
        <div className="flex justify-end gap-2">
          {" "}
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-border px-3 py-2 text-sm text-secondary hover:bg-surface-muted"
            >
              {" "}
              Open externally{" "}
            </a>
          ) : (
            <span className="rounded-lg border border-light px-3 py-2 text-sm text-muted">
              {" "}
              No external URL{" "}
            </span>
          )}{" "}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-interactive px-3 py-2 text-sm font-medium text-white hover:bg-interactive-hover dark:hover:bg-primary-400"
          >
            {" "}
            Done{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
    </Modal>
  );
}
