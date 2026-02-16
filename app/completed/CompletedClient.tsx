"use client";
import { useRouter } from "next/navigation";
type Lesson = {
  id: string;
  title: string;
  planned_date: string | null;
  curriculum_name: string;
  subject_name: string;
  subject_color: string;
  child_name: string;
  child_id: string;
  completed_at: string | null;
  grade: number | null;
  notes: string | null;
};
type Props = {
  children: { id: string; name: string }[];
  subjects: { id: string; name: string; color: string }[];
  years: { id: string; label: string }[];
  lessons: Lesson[];
  filters: {
    child: string;
    subject: string;
    start: string;
    end: string;
    year: string;
  };
};
function getWeekLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return `${fmt(monday)} – ${fmt(sunday)}, ${monday.getFullYear()}`;
}
function getWeekKey(dateStr: string): string {
  const date = new Date(dateStr);
  const day = date.getDay();
  const monday = new Date(date);
  monday.setDate(date.getDate() - ((day + 6) % 7));
  return monday.toISOString().slice(0, 10);
}
type GroupedData = {
  childName: string;
  weeks: {
    weekKey: string;
    weekLabel: string;
    subjects: {
      subjectName: string;
      subjectColor: string;
      lessons: Lesson[];
    }[];
  }[];
}[];
function groupLessons(lessons: Lesson[]): GroupedData {
  const byChild: Record<string, Record<string, Record<string, Lesson[]>>> = {};

  for (const lesson of lessons) {
    const child = lesson.child_name;
    const weekKey = lesson.completed_at
      ? getWeekKey(lesson.completed_at)
      : "undated";
    const subject = lesson.subject_name;

    if (!byChild[child]) byChild[child] = {};
    if (!byChild[child][weekKey]) byChild[child][weekKey] = {};
    if (!byChild[child][weekKey][subject])
      byChild[child][weekKey][subject] = [];

    byChild[child][weekKey][subject].push(lesson);
  }

  return Object.entries(byChild)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([childName, weeks]) => ({
      childName,
      weeks: Object.entries(weeks)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([weekKey, subjects]) => ({
          weekKey,
          weekLabel: weekKey === "undated" ? "Undated" : getWeekLabel(weekKey),
          subjects: Object.entries(subjects)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([subjectName, subjectLessons]) => ({
              subjectName,
              subjectColor: subjectLessons[0]?.subject_color || "#6b7280",
              lessons: subjectLessons.sort((a, b) =>
                (a.completed_at || "").localeCompare(b.completed_at || ""),
              ),
            })),
        })),
    }));
}
export default function CompletedClient({
  children,
  subjects,
  years,
  lessons,
  filters,
}: Props) {
  const router = useRouter();
  const grouped = groupLessons(lessons);
  function updateFilters(updates: Partial<typeof filters>) {
    const next = { ...filters, ...updates };
    const params = new URLSearchParams();
    if (next.child) params.set("child", next.child);
    if (next.subject) params.set("subject", next.subject);
    if (next.start) params.set("start", next.start);
    if (next.end) params.set("end", next.end);
    if (next.year) params.set("year", next.year);
    router.push(`/completed?${params.toString()}`);
  }
  return (
    <>
      {" "}
      {/* Filters (hidden when printing) */}{" "}
      <div className="mb-6 flex flex-wrap items-end gap-3 print:hidden">
        {" "}
        <div>
          {" "}
          <label className="block text-xs font-medium text-tertiary">
            {" "}
            Student{" "}
          </label>{" "}
          <select
            value={filters.child}
            onChange={(e) => updateFilters({ child: e.target.value })}
            className="mt-0.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-primary"
          >
            {" "}
            <option value="">All Students</option>{" "}
            {children.map((c) => (
              <option key={c.id} value={c.id}>
                {" "}
                {c.name}{" "}
              </option>
            ))}{" "}
          </select>{" "}
        </div>{" "}
        <div>
          {" "}
          <label className="block text-xs font-medium text-tertiary">
            School Year
          </label>{" "}
          <select
            value={filters.year}
            onChange={(e) => updateFilters({ year: e.target.value })}
            className="mt-0.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-primary"
          >
            {" "}
            <option value="">All Years</option>{" "}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {" "}
                {y.label}{" "}
              </option>
            ))}{" "}
          </select>{" "}
        </div>{" "}
        <div>
          {" "}
          <label className="block text-xs font-medium text-tertiary">
            {" "}
            Subject{" "}
          </label>{" "}
          <select
            value={filters.subject}
            onChange={(e) => updateFilters({ subject: e.target.value })}
            className="mt-0.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-primary"
          >
            {" "}
            <option value="">All Subjects</option>{" "}
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {" "}
                {s.name}{" "}
              </option>
            ))}{" "}
          </select>{" "}
        </div>{" "}
        <div>
          {" "}
          <label className="block text-xs font-medium text-tertiary">
            {" "}
            From{" "}
          </label>{" "}
          <input
            type="date"
            value={filters.start}
            onChange={(e) => updateFilters({ start: e.target.value })}
            className="mt-0.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-primary"
          />{" "}
        </div>{" "}
        <div>
          {" "}
          <label className="block text-xs font-medium text-tertiary">
            {" "}
            To{" "}
          </label>{" "}
          <input
            type="date"
            value={filters.end}
            onChange={(e) => updateFilters({ end: e.target.value })}
            className="mt-0.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-primary"
          />{" "}
        </div>{" "}
        <button
          onClick={() =>
            updateFilters({
              child: "",
              subject: "",
              start: "",
              end: "",
              year: "",
            })
          }
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-tertiary hover:bg-surface-muted"
        >
          {" "}
          Clear{" "}
        </button>{" "}
        <div className="ml-auto">
          {" "}
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-interactive px-4 py-1.5 text-sm font-medium text-white hover:bg-interactive-hover"
          >
            {" "}
            Print / Save PDF{" "}
          </button>{" "}
        </div>{" "}
      </div>{" "}
      {/* Print header (visible only when printing) */}{" "}
      <div className="hidden print:block print:mb-6">
        {" "}
        <h1 className="text-2xl font-bold">Completed Work Report</h1>{" "}
        <p className="text-sm text-tertiary">
          {" "}
          {filters.child
            ? children.find((c) => c.id === filters.child)?.name
            : "All Students"}{" "}
          {filters.start && `| From: ${filters.start}`}{" "}
          {filters.end && `| To: ${filters.end}`}{" "}
          {filters.year &&
            `| Year: ${years.find((y) => y.id === filters.year)?.label || filters.year}`}{" "}
          {" |"} {lessons.length} lesson{lessons.length !== 1 ? "s" : ""}{" "}
        </p>{" "}
      </div>{" "}
      {/* Summary */}{" "}
      <div className="mb-4 text-sm text-muted print:hidden">
        {" "}
        {lessons.length} completed lesson{lessons.length !== 1 ? "s" : ""}{" "}
      </div>{" "}
      {/* Results: Child → Week → Subject → Lessons */}{" "}
      {grouped.length === 0 ? (
        <div className="rounded-xl border border-light bg-surface p-8 text-center text-sm text-muted">
          {" "}
          No completed lessons found with the current filters.{" "}
        </div>
      ) : (
        <div className="space-y-10 print:space-y-8">
          {" "}
          {grouped.map((child) => (
            <div key={child.childName}>
              {" "}
              {/* Child name */}{" "}
              <h2 className="mb-4 border-b-2 border-primary pb-1 text-lg font-bold uppercase tracking-wide print:mb-3 print:text-xl">
                {" "}
                {child.childName}{" "}
              </h2>{" "}
              <div className="space-y-6 print:space-y-5">
                {" "}
                {child.weeks.map((week) => (
                  <div key={week.weekKey}>
                    {" "}
                    {/* Week header */}{" "}
                    <h3 className="mb-3 text-sm font-semibold text-secondary print:text-base print:font-bold print:text-black">
                      {" "}
                      Week of {week.weekLabel}{" "}
                    </h3>{" "}
                    {/* Subject cards in a responsive grid */}{" "}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-2">
                      {" "}
                      {week.subjects.map((subject) => (
                        <div
                          key={subject.subjectName}
                          className="rounded-lg border border-light bg-surface shadow-sm print:break-inside-avoid print:shadow-none"
                          style={{
                            borderTopWidth: "3px",
                            borderTopColor: subject.subjectColor,
                          }}
                        >
                          {" "}
                          {/* Subject header */}{" "}
                          <div className="border-b border-gray-100 px-3 py-2">
                            {" "}
                            <h4 className="text-sm font-semibold text-primary">
                              {" "}
                              {subject.subjectName}{" "}
                            </h4>{" "}
                          </div>{" "}
                          {/* Lessons as bullet list */}{" "}
                          <ul className="px-3 py-2 space-y-1.5">
                            {" "}
                            {subject.lessons.map((l) => (
                              <li key={l.id} className="text-sm leading-snug">
                                {" "}
                                <div className="flex items-start gap-1.5">
                                  {" "}
                                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-border" />{" "}
                                  <div className="min-w-0">
                                    {" "}
                                    <span className="font-medium text-primary">
                                      {" "}
                                      {l.title}{" "}
                                    </span>{" "}
                                    {l.curriculum_name && (
                                      <span className="text-muted">
                                        {" "}
                                        {""} — {l.curriculum_name}{" "}
                                      </span>
                                    )}{" "}
                                    {l.grade != null && (
                                      <span className="ml-1.5 inline-block rounded bg-surface-subtle px-1.5 py-0.5 text-xs font-medium text-secondary print:border print:border-border print:bg-transparent">
                                        {" "}
                                        {Number(l.grade).toFixed(0)}%{" "}
                                      </span>
                                    )}{" "}
                                    {l.notes && (
                                      <p className="mt-0.5 text-xs italic text-muted">
                                        {" "}
                                        {l.notes}{" "}
                                      </p>
                                    )}{" "}
                                  </div>{" "}
                                </div>{" "}
                              </li>
                            ))}{" "}
                          </ul>{" "}
                        </div>
                      ))}{" "}
                    </div>{" "}
                  </div>
                ))}{" "}
              </div>{" "}
            </div>
          ))}{" "}
        </div>
      )}{" "}
    </>
  );
}
