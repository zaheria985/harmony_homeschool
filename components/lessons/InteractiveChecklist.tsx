"use client";

import { useTransition } from "react";
import { toggleChecklistItem } from "@/lib/actions/lessons";

export type ChecklistItem = { text: string; index: number };

export function parseChecklist(description: string | null): ChecklistItem[] {
  if (!description) return [];
  const items: ChecklistItem[] = [];
  const lines = description.split("\n");
  let idx = 0;
  for (const line of lines) {
    const match = line.match(/^(\s*[-*]\s*)\[[ xX]?\]\s*(.+)/);
    if (match) {
      items.push({ text: match[2].trim(), index: idx });
      idx++;
    }
  }
  return items;
}

export function checklistProgress(
  items: ChecklistItem[],
  state: Record<string, boolean>,
): { checked: number; total: number } {
  const total = items.length;
  const checked = items.filter((item) => state[String(item.index)]).length;
  return { checked, total };
}

export default function InteractiveChecklist({
  lessonId,
  items,
  state,
}: {
  lessonId: string;
  items: ChecklistItem[];
  state: Record<string, boolean>;
}) {
  const [isPending, startTransition] = useTransition();

  if (items.length === 0) return null;

  const { checked, total } = checklistProgress(items, state);

  function handleToggle(itemIndex: number, currentlyChecked: boolean) {
    startTransition(async () => {
      await toggleChecklistItem(lessonId, itemIndex, !currentlyChecked);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted">
          Checklist ({checked}/{total})
        </p>
        {total > 0 && (
          <div className="h-1.5 w-20 rounded-full bg-surface-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--success-solid)] transition-all"
              style={{ width: `${(checked / total) * 100}%` }}
            />
          </div>
        )}
      </div>
      <div className="space-y-0.5">
        {items.map((item) => {
          const isChecked = !!state[String(item.index)];
          return (
            <label
              key={item.index}
              className={`flex items-start gap-2 rounded px-1 py-0.5 text-sm cursor-pointer hover:bg-surface-muted ${isPending ? "opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(item.index, isChecked)}
                disabled={isPending}
                className="mt-0.5 h-4 w-4 rounded border-light text-interactive focus:ring-focus"
              />
              <span className={isChecked ? "text-muted line-through" : "text-secondary"}>
                {item.text}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
