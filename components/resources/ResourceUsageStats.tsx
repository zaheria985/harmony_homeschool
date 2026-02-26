"use client";

import { useState } from "react";

type UsageStat = {
  id: string;
  title: string;
  type: string;
  lesson_count: number;
  curriculum_count: number;
  last_used: string | null;
};

const typeIcons: Record<string, string> = {
  book: "📕",
  video: "🎬",
  pdf: "📄",
  link: "🔗",
  supply: "🧰",
};

export default function ResourceUsageStats({ stats }: { stats: UsageStat[] }) {
  const [expanded, setExpanded] = useState(false);
  const unused = stats.filter((s) => s.lesson_count === 0).length;

  return (
    <div className="mt-6 rounded-lg border bg-surface p-4">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left"
      >
        <div>
          <h3 className="text-sm font-semibold text-secondary">
            Usage Analytics
          </h3>
          <p className="text-xs text-muted">
            {stats.length} resources, {unused} unused
          </p>
        </div>
        <span className="text-sm text-muted">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium uppercase text-muted">
                <th className="pb-2 pr-4">Resource</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4 text-right">Lessons</th>
                <th className="pb-2 pr-4 text-right">Curricula</th>
                <th className="pb-2 text-right">Last Used</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr
                  key={s.id}
                  className={`border-b border-light last:border-0 ${
                    s.lesson_count === 0
                      ? "bg-amber-50 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300"
                      : ""
                  }`}
                >
                  <td className="py-2 pr-4">
                    <span className="mr-1.5">
                      {typeIcons[s.type] || "📦"}
                    </span>
                    <span className="truncate">{s.title}</span>
                  </td>
                  <td className="py-2 pr-4 capitalize">{s.type}</td>
                  <td className="py-2 pr-4 text-right font-medium">
                    {s.lesson_count}
                  </td>
                  <td className="py-2 pr-4 text-right">{s.curriculum_count}</td>
                  <td className="py-2 text-right text-xs text-muted">
                    {s.last_used
                      ? new Date(s.last_used).toLocaleDateString()
                      : "Never"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
