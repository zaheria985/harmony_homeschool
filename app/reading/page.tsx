export const dynamic = "force-dynamic";

import {
  getReadingLog,
  getBookResources,
  getReadingStats,
} from "@/lib/queries/reading";
import { getAllChildren } from "@/lib/queries/students";
import { getCurrentUser } from "@/lib/session";
import PageHeader from "@/components/ui/PageHeader";
import ReadingLogClient from "@/components/reading/ReadingLogClient";

export default async function ReadingPage() {
  const user = await getCurrentUser();
  // A kid sees and logs only their own reading; the action enforces the same
  // scope server-side, this just keeps the page honest.
  const childId = user.role === "kid" ? user.childId || undefined : undefined;

  const [entries, books, children, stats] = await Promise.all([
    getReadingLog(childId),
    getBookResources(),
    getAllChildren(user.role === "parent" ? user.id : undefined),
    getReadingStats(childId),
  ]);

  const visibleChildren = childId
    ? (children as Array<{ id: string }>).filter((c) => c.id === childId)
    : children;

  return (
    <div>
      <PageHeader
        title="Reading Log"
        subtitle={`${stats.books_read} ${Number(stats.books_read) === 1 ? "book" : "books"} · ${stats.total_minutes} minutes logged`}
      />
      <ReadingLogClient
        entries={entries}
        books={books}
        children={visibleChildren}
        stats={stats}
      />
    </div>
  );
}
