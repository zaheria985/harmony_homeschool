export const dynamic = "force-dynamic";

import {
  getReadingLog,
  getBookResources,
  getReadingStats,
} from "@/lib/queries/reading";
import { getAllChildren } from "@/lib/queries/students";
import PageHeader from "@/components/ui/PageHeader";
import ReadingLogClient from "@/components/reading/ReadingLogClient";

export default async function ReadingPage() {
  const [entries, books, children, stats] = await Promise.all([
    getReadingLog(),
    getBookResources(),
    getAllChildren(),
    getReadingStats(),
  ]);

  return (
    <div>
      <PageHeader title="Reading Log" />
      <ReadingLogClient
        entries={entries}
        books={books}
        children={children}
        stats={stats}
      />
    </div>
  );
}
