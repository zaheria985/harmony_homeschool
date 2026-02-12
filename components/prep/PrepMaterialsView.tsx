"use client";
import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
export type PrepMaterial = {
  lesson_id: string;
  lesson_title: string;
  planned_date: string;
  child_id: string;
  child_name: string;
  subject_name: string;
  curriculum_name: string;
  material_id: string;
  material_title: string;
  material_type: string;
  material_thumbnail: string | null;
};
type GroupMode = "date" | "subject" | "course";
const CHECKLIST_STORAGE_KEY = "prep-checklist-v1";
function getDateKey(value: string) {
  return value?.split("T")[0] || "undated";
}
function formatDayLabel(dayKey: string) {
  if (dayKey === "undated") return "Undated";
  return new Date(`${dayKey}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}
function getChecklistKey(item: PrepMaterial) {
  return `${item.child_id}|${item.material_type}|${item.material_title.trim().toLowerCase()}`;
}
function getItemKey(item: PrepMaterial) {
  return `${item.lesson_id}-${item.material_id}`;
}
function PrepItemCard({
  item,
  checked,
  onToggle,
  showDay,
}: {
  item: PrepMaterial;
  checked: boolean;
  onToggle: (item: PrepMaterial) => void;
  showDay?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border bg-surface p-2.5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md sm:p-3 ${checked ? "border-emerald-300 bg-emerald-50/70 dark:border-emerald-600/50 dark:bg-emerald-900/20" : "border-light"}`}
    >
      {" "}
      <div className="flex items-start gap-2.5 sm:gap-3">
        {" "}
        <input
          type="checkbox"
          checked={checked}
          onChange={() => onToggle(item)}
          className="mt-0.5 h-4 w-4 rounded border-border text-interactive focus:ring-focus"
          aria-label={`Mark ${item.material_title} as gathered`}
        />{" "}
        {item.material_thumbnail ? (
          <div className="h-16 w-12 flex-shrink-0 overflow-hidden rounded-md border border-light bg-surface-muted p-1 sm:h-20 sm:w-[60px]">
            {" "}
            {/* eslint-disable-next-line @next/next/no-img-element */}{" "}
            <img
              src={item.material_thumbnail}
              alt={item.material_title}
              className="h-full w-full rounded object-contain"
            />{" "}
          </div>
        ) : (
          <div className="flex h-16 w-12 flex-shrink-0 items-center justify-center rounded-md border border-light bg-surface-muted text-xl sm:h-20 sm:w-[60px] sm:text-2xl">
            {" "}
            {item.material_type === "book" ? "📕" : "🧰"}{" "}
          </div>
        )}{" "}
        <div className="min-w-0 flex-1">
          {" "}
          <div className="flex items-start justify-between gap-2">
            {" "}
            <p className="line-clamp-2 text-xs font-semibold text-primary sm:text-sm">
              {item.material_title}
            </p>{" "}
            <span className="rounded-full bg-surface-subtle px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-tertiary sm:px-2 sm:text-[10px]">
              {" "}
              {item.material_type}{" "}
            </span>{" "}
          </div>{" "}
          <p className="mt-1 text-xs text-tertiary">
            {" "}
            {item.child_name} · {item.subject_name} ·{" "}
            {item.curriculum_name}{" "}
          </p>{" "}
          <p className="text-xs text-muted dark:text-slate-400">
            Lesson: {item.lesson_title}
          </p>{" "}
          {showDay && (
            <p className="mt-1 text-xs font-medium text-interactive-hover">
              {" "}
              Needed: {formatDayLabel(getDateKey(item.planned_date))}{" "}
            </p>
          )}{" "}
        </div>{" "}
      </div>{" "}
    </div>
  );
}
export default function PrepMaterialsView({
  materials,
}: {
  materials: PrepMaterial[];
}) {
  const [groupMode, setGroupMode] = useState<GroupMode>("date");
  const [checkedMap, setCheckedMap] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(CHECKLIST_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setCheckedMap(parsed);
    } catch {
      setCheckedMap({});
    }
  }, []);
  useEffect(() => {
    window.localStorage.setItem(
      CHECKLIST_STORAGE_KEY,
      JSON.stringify(checkedMap),
    );
  }, [checkedMap]);
  function toggleChecked(item: PrepMaterial) {
    const key = getChecklistKey(item);
    setCheckedMap((current) => ({ ...current, [key]: !current[key] }));
  }
  const byDate = useMemo(() => {
    const grouped = new Map<string, Map<string, PrepMaterial>>();
    for (const row of materials) {
      const dayKey = getDateKey(row.planned_date);
      if (!grouped.has(dayKey)) grouped.set(dayKey, new Map());
      const dedupKey = getChecklistKey(row);
      if (!grouped.get(dayKey)!.has(dedupKey))
        grouped.get(dayKey)!.set(dedupKey, row);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dayKey, values]) => ({
        dayKey,
        items: Array.from(values.values()),
      }));
  }, [materials]);
  const bySubject = useMemo(() => {
    const grouped = new Map<string, Map<string, PrepMaterial>>();
    for (const row of materials) {
      const groupKey = row.subject_name;
      if (!grouped.has(groupKey)) grouped.set(groupKey, new Map());
      const dedupKey = `${getChecklistKey(row)}|${getDateKey(row.planned_date)}`;
      if (!grouped.get(groupKey)!.has(dedupKey))
        grouped.get(groupKey)!.set(dedupKey, row);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([subjectName, values]) => ({
        title: subjectName,
        items: Array.from(values.values()).sort((a, b) =>
          getDateKey(a.planned_date).localeCompare(getDateKey(b.planned_date)),
        ),
      }));
  }, [materials]);
  const byCourse = useMemo(() => {
    const grouped = new Map<string, Map<string, PrepMaterial>>();
    for (const row of materials) {
      const groupKey = row.curriculum_name;
      if (!grouped.has(groupKey)) grouped.set(groupKey, new Map());
      const dedupKey = `${getChecklistKey(row)}|${getDateKey(row.planned_date)}`;
      if (!grouped.get(groupKey)!.has(dedupKey))
        grouped.get(groupKey)!.set(dedupKey, row);
    }
    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([courseName, values]) => ({
        title: courseName,
        items: Array.from(values.values()).sort((a, b) =>
          getDateKey(a.planned_date).localeCompare(getDateKey(b.planned_date)),
        ),
      }));
  }, [materials]);
  const gatheredCount = useMemo(() => {
    const gathered = new Set<string>();
    for (const item of materials) {
      const key = getChecklistKey(item);
      if (checkedMap[key]) gathered.add(key);
    }
    return gathered.size;
  }, [checkedMap, materials]);
  return (
    <div className="space-y-4">
      {" "}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {" "}
        <div className="inline-flex w-full flex-wrap rounded-lg border border-light bg-surface p-1 sm:w-auto sm:flex-nowrap">
          {" "}
          <button
            type="button"
            onClick={() => setGroupMode("date")}
            className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm ${groupMode === "date" ? "bg-interactive-medium text-interactive-hover/40 dark:text-primary-200" : "text-tertiary hover:bg-surface-subtle dark:hover:bg-slate-800"}`}
          >
            {" "}
            By Date{" "}
          </button>{" "}
          <button
            type="button"
            onClick={() => setGroupMode("subject")}
            className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm ${groupMode === "subject" ? "bg-interactive-medium text-interactive-hover/40 dark:text-primary-200" : "text-tertiary hover:bg-surface-subtle dark:hover:bg-slate-800"}`}
          >
            {" "}
            By Subject{" "}
          </button>{" "}
          <button
            type="button"
            onClick={() => setGroupMode("course")}
            className={`flex-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors sm:flex-none sm:px-3 sm:text-sm ${groupMode === "course" ? "bg-interactive-medium text-interactive-hover/40 dark:text-primary-200" : "text-tertiary hover:bg-surface-subtle dark:hover:bg-slate-800"}`}
          >
            {" "}
            By Course{" "}
          </button>{" "}
        </div>{" "}
        <p className="text-xs text-tertiary sm:text-sm">
          {" "}
          Gathered:{" "}
          <span className="font-semibold text-primary">
            {gatheredCount}
          </span>{" "}
        </p>{" "}
      </div>{" "}
      {groupMode === "date" ? (
        <div className="pb-2">
          {" "}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {" "}
            {byDate.map((group) => (
              <Card
                key={group.dayKey}
                className="min-h-[20rem]"
                title={formatDayLabel(group.dayKey)}
              >
                {" "}
                <div className="space-y-3">
                  {" "}
                  {group.items.map((item) => (
                    <PrepItemCard
                      key={getItemKey(item)}
                      item={item}
                      checked={!!checkedMap[getChecklistKey(item)]}
                      onToggle={toggleChecked}
                    />
                  ))}{" "}
                </div>{" "}
              </Card>
            ))}{" "}
          </div>{" "}
        </div>
      ) : (
        <div className="space-y-4">
          {" "}
          {(groupMode === "subject" ? bySubject : byCourse).map((group) => (
            <Card key={group.title} title={group.title}>
              {" "}
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {" "}
                {group.items.map((item) => (
                  <PrepItemCard
                    key={`${group.title}-${getItemKey(item)}`}
                    item={item}
                    checked={!!checkedMap[getChecklistKey(item)]}
                    onToggle={toggleChecked}
                    showDay
                  />
                ))}{" "}
              </div>{" "}
            </Card>
          ))}{" "}
        </div>
      )}{" "}
    </div>
  );
}
