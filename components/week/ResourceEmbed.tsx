import type { LessonResource } from "@/lib/queries/week";

export default function ResourceEmbed({
  resource,
}: {
  resource: LessonResource;
}) {
  const label = resource.title || resource.url;

  if (resource.type === "youtube") {
    // Extract video ID from various YouTube URL formats
    const videoId = extractYouTubeId(resource.url);
    if (videoId) {
      return (
        <div className="overflow-hidden rounded-lg border border-light">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${videoId}`}
            className="aspect-video w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={resource.title || "YouTube video"}
          />
        </div>
      );
    }
  }

  if (resource.type === "pdf") {
    return (
      <a
        href={resource.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-lg border border-light px-3 py-2 text-sm text-secondary hover:bg-surface-muted"
      >
        <span className="text-red-500">PDF</span>
        <span className="truncate">{label}</span>
        {resource.page_number && (
          <span className="text-xs text-muted">
            p.{resource.page_number}
          </span>
        )}
      </a>
    );
  }

  // Generic URL
  return (
    <a
      href={resource.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-lg border border-light px-3 py-2 text-sm text-interactive hover:bg-surface-muted"
    >
      <span className="truncate">{label}</span>
    </a>
  );
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}
