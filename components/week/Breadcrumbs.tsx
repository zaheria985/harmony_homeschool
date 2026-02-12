"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { formatWeekLabel, formatWeekday } from "@/lib/utils/dates";

export default function Breadcrumbs({ subjectName }: { subjectName?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const childParam = searchParams.get("child");
  const qs = childParam ? `?child=${childParam}` : "";

  // Parse path: /week/{weekStart}/{date?}/{subjectId?}
  const parts = pathname.split("/").filter(Boolean);
  // parts[0] = "week", parts[1] = weekStart, parts[2] = date, parts[3] = subjectId
  const weekStart = parts[1];
  const date = parts[2];

  if (!weekStart) return null;

  return (
    <nav className="flex items-center gap-1.5 text-sm text-muted">
      <Link href={`/week/${weekStart}${qs}`} className="hover:text-interactive">
        {formatWeekLabel(weekStart)}
      </Link>
      {date && (
        <>
          <span>/</span>
          <Link
            href={`/week/${weekStart}/${date}${qs}`}
            className="hover:text-interactive"
          >
            {formatWeekday(date)}
          </Link>
        </>
      )}
      {subjectName && (
        <>
          <span>/</span>
          <span className="font-medium text-primary">{subjectName}</span>
        </>
      )}
    </nav>
  );
}
