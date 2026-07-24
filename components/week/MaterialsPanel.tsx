"use client";
import { useState } from "react";
import { ChevronDown, ChevronRight, Package } from "lucide-react";

export type PanelMaterial = {
  material_id: string;
  material_title: string;
  material_type: string;
  lesson_title: string;
  planned_date: string;
  child_name: string;
  subject_name: string;
  curriculum_name: string;
};

/**
 * Books and supplies needed in the week being planned. This used to be its own
 * "Weekly Prep" page, which meant checking supplies and scheduling the work
 * they belong to were two separate trips.
 */
export default function MaterialsPanel({
  materials,
}: {
  materials: PanelMaterial[];
}) {
  const [open, setOpen] = useState(false);

  if (materials.length === 0) return null;

  // One row per distinct material, listing every day it is needed.
  const byMaterial = new Map<string, PanelMaterial[]>();
  for (const material of materials) {
    const key = material.material_title;
    if (!byMaterial.has(key)) byMaterial.set(key, []);
    byMaterial.get(key)!.push(material);
  }

  return (
    <div className="mb-3 rounded-2xl border border-light bg-surface shadow-warm">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex min-h-[44px] w-full items-center gap-2 px-3 py-2 text-left text-sm"
      >
        <Package size={16} className="text-[var(--accent-solid)]" />
        <span className="font-medium text-primary">Materials this week</span>
        <span className="text-muted">
          · {byMaterial.size} {byMaterial.size === 1 ? "item" : "items"}
        </span>
        <span className="ml-auto text-muted">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
      </button>
      {open && (
        <ul className="border-t border-light px-3 py-2">
          {Array.from(byMaterial.entries()).map(([title, uses]) => (
            <li
              key={title}
              className="flex flex-wrap items-baseline gap-x-2 border-b border-light py-1.5 text-xs last:border-b-0"
            >
              <span className="font-medium text-primary">{title}</span>
              <span className="text-muted">
                {uses[0].subject_name} · {uses[0].curriculum_name}
              </span>
              <span className="ml-auto text-tertiary">
                {Array.from(new Set(uses.map((use) => weekdayOf(use.planned_date)))).join(
                  ", ",
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function weekdayOf(dateKey: string) {
  return new Date(dateKey + "T00:00:00").toLocaleDateString(undefined, {
    weekday: "short",
  });
}
