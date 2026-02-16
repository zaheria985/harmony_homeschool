import Link from "next/link";
type BookCardProps = {
  book: {
    id: string;
    title: string;
    author: string | null;
    thumbnail_url: string | null;
    tags: string[];
  };
  draggable?: boolean;
  onDragStart?: (bookId: string) => void;
};
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
export default function BookCard({
  book,
  draggable = false,
  onDragStart,
}: BookCardProps) {
  return (
    <div
      draggable={draggable}
      onDragStart={() => onDragStart?.(book.id)}
      className="h-full rounded-lg border border-slate bg-surface shadow-sm transition-all duration-200 hover:border-interactive-border hover:shadow-md dark:hover:border-primary-600"
    >
      {" "}
      <Link href={`/resources/${book.id}`} className="block h-full">
        {" "}
        <div className="flex h-full flex-col">
          {" "}
          {book.thumbnail_url ? (
            <div className="overflow-hidden rounded-t-lg border-b border-slate">
              {" "}
              {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
              <img
                src={book.thumbnail_url}
                alt={book.title}
                className="aspect-[3/4] w-full bg-transparent object-contain p-2"
              />{" "}
            </div>
          ) : (
            <div className="flex aspect-[3/4] w-full items-center justify-center rounded-t-lg border-b border-slate text-3xl">
              {" "}
              📕{" "}
            </div>
          )}{" "}
          <div className="flex flex-1 flex-col p-3">
            {" "}
            <p className="line-clamp-2 text-sm font-semibold text-primary">
              {book.title}
            </p>{" "}
            <p className="mt-1 line-clamp-1 text-xs text-tertiary">
              {book.author || "Unknown author"}
            </p>{" "}
            {book.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {" "}
                {book.tags.slice(0, 3).map((tag) => (
                  <span
                    key={`${book.id}-${tag}`}
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${styleForTag(tag)}`}
                  >
                    {" "}
                    {tag}{" "}
                  </span>
                ))}{" "}
              </div>
            )}{" "}
          </div>{" "}
        </div>{" "}
      </Link>{" "}
    </div>
  );
}
